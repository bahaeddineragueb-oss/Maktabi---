/** Secure document management: upload, versioning, tags, download, metadata-only. */
import React, { useEffect, useState } from 'react';
import {
  Table, Button, Card, Select, Input, Modal, Form, Upload, Tag, App, Space, Drawer,
  Descriptions, Alert, List, DatePicker
} from 'antd';
import { PlusOutlined, SearchOutlined, UploadOutlined, FileTextOutlined, DownloadOutlined, HistoryOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api, download, getToken } from '../api.js';
import { PageHeader, docTypeOptions, VerifyBadge } from '../components/common.jsx';

export default function Documents() {
  const { t, pick } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', doc_type: '' });
  const [meta, setMeta] = useState({ cases: [], clients: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      const data = await api(`/documents?${params}&limit=100`);
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) { message.error(t('errors.server')); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);
  useEffect(() => {
    Promise.all([api('/cases?limit=200'), api('/clients?limit=200')]).then(([cases, clients]) =>
      setMeta({ cases: cases.rows, clients: clients.rows })).catch(() => {});
  }, []);

  const submit = async () => {
    const v = await form.validateFields();
    const fd = new FormData();
    (fileList || []).forEach((f) => fd.append('files', f.originFileObj || f));
    Object.entries(v).forEach(([k, val]) => {
      if (val !== undefined && val !== null) fd.append(k, val instanceof Object ? val.format?.('YYYY-MM-DD') || String(val) : val);
    });
    try {
      const res = await api('/documents', { method: 'POST', body: fd, formData: true });
      message.success(`${res.created.length} ✓`);
      setModalOpen(false);
      setFileList([]);
      form.resetFields();
      load();
    } catch (e) { message.error(e.message); }
  };

  const columns = [
    {
      title: t('common.name'), dataIndex: 'title',
      render: (v, r) => (
        <div>
          <a onClick={() => api(`/documents/${r.id}`).then(setDetail)} style={{ fontWeight: 600 }}>{v}</a>
          {r.version > 1 && <Tag style={{ marginInlineStart: 6 }}>v{r.version}</Tag>}
          {r.tags && r.tags.split(',').filter(Boolean).map((tag) => <Tag key={tag} color="blue" style={{ marginInlineStart: 4 }}>{tag.trim()}</Tag>)}
        </div>
      )
    },
    { title: t('documents.docType'), dataIndex: 'doc_type', width: 160, render: (v) => t(`documents.type.${v}`) || v },
    { title: t('common.case'), dataIndex: 'case_reference', width: 130, render: (v, r) => v ? <a onClick={() => nav(`/cases/${r.case_id}`)}>{v}</a> : '—' },
    { title: t('common.client'), dataIndex: 'client_name_fr', width: 150, ellipsis: true, render: (v, r) => r.client_legal_name || v || '—' },
    { title: t('common.created'), dataIndex: 'created_at', width: 105, render: (v) => v?.slice(0, 10) },
    {
      title: t('common.actions'), width: 110,
      render: (r) => (
        <Space>
          {r.file_path && <Button size="small" icon={<DownloadOutlined />} onClick={() => download(`/documents/${r.id}/download`, r.original_name)} />}
          {!r.file_path && <Tag>{t('documents.fileMissing')}</Tag>}
        </Space>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title={t('documents.title')}
        subtitle={t('documents.subtitle')}
        extra={can('documents.upload') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>{t('documents.newDocument')}</Button>}
      />
      <Card size="small" style={{ marginBottom: 14 }}>
        <Space wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder={t('common.search')} style={{ width: 240 }}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <Select allowClear placeholder={t('documents.docType')} style={{ width: 200 }}
            options={docTypeOptions(t)}
            onChange={(v) => setFilters((f) => ({ ...f, doc_type: v || '' }))} />
        </Space>
      </Card>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} size="middle"
        pagination={{ total, pageSize: 50, showTotal: (tot) => `${tot} ${t('common.results')}` }} />

      <Modal title={t('documents.newDocument')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')} width={620}>
        <Form form={form} layout="vertical">
          <Form.Item label={t('documents.file')}>
            <Upload.Dragger
              multiple
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: fl }) => setFileList(fl)}
              accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png,.zip,.txt,.md"
            >
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">PDF · DOCX · XLSX · JPG · PNG · ZIP (≤ 50 MB)</p>
            </Upload.Dragger>
          </Form.Item>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('documents.ocrHint')} />
          <Form.Item name="title" label={t('common.name')}><Input placeholder={fileList.length ? fileList[0].name : ''} /></Form.Item>
          <Form.Item name="doc_type" label={t('documents.docType')} initialValue="other">
            <Select options={docTypeOptions(t)} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="case_id" label={t('common.case')}>
              <Select allowClear showSearch optionFilterProp="label" style={{ width: 250 }} options={meta.cases.map((c) => ({ value: c.id, label: `${c.reference} — ${pick(c, 'title')}` }))} />
            </Form.Item>
            <Form.Item name="client_id" label={t('common.client')}>
              <Select allowClear showSearch optionFilterProp="label" style={{ width: 220 }}
                options={meta.clients.map((c) => ({ value: c.id, label: c.legal_name || pick(c, 'full_name') || `#${c.id}` }))} />
            </Form.Item>
          </Space>
          <Form.Item name="tags" label={t('documents.tags')}><Input placeholder="contrat, 2026, …" /></Form.Item>
          <Form.Item name="ocr_text" label={t('documents.ocrText')}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Drawer title={detail?.title} open={!!detail} onClose={() => setDetail(null)} width={620}>
        {detail && (
          <>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={t('documents.docType')}>{t(`documents.type.${detail.doc_type}`)}</Descriptions.Item>
              <Descriptions.Item label={t('common.case')}>{detail.case_reference ? <a onClick={() => nav(`/cases/${detail.case_id}`)}>{detail.case_reference} — {detail.case_title_fr}</a> : '—'}</Descriptions.Item>
              <Descriptions.Item label={t('common.client')}>{detail.client_legal_name || detail.client_name_fr || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('documents.version')}>v{detail.version}</Descriptions.Item>
              <Descriptions.Item label={t('common.created')}>{detail.created_at?.slice(0, 16).replace('T', ' ')} — {detail.creator_name_fr}</Descriptions.Item>
              {detail.original_name && <Descriptions.Item label={t('documents.file')}><span className="mono">{detail.original_name} ({Math.round((detail.size || 0) / 1024)} KB)</span></Descriptions.Item>}
              {detail.ocr_text && <Descriptions.Item label={t('documents.ocrText')}>{detail.ocr_text}</Descriptions.Item>}
              {detail.notes && <Descriptions.Item label={t('common.notes')}>{detail.notes}</Descriptions.Item>}
            </Descriptions>
            <div style={{ margin: '14px 0' }}>
              {detail.file_path
                ? <Button type="primary" icon={<DownloadOutlined />} onClick={() => download(`/documents/${detail.id}/download`, detail.original_name)}>{t('common.download')}</Button>
                : <Alert type="warning" message={t('documents.fileMissing')} />}
            </div>
            <Card size="small" title={<span><HistoryOutlined /> {t('documents.versions')}</span>}>
              <List
                size="small"
                dataSource={detail.versions || []}
                renderItem={(v) => (
                  <List.Item actions={v.file_path || v.id === detail.id ? undefined : undefined}>
                    <span>v{v.version} · {v.created_at?.slice(0, 10)}</span>
                  </List.Item>
                )}
              />
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
}
