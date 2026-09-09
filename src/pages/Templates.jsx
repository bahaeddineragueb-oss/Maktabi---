/** Template engine: bilingual templates with {{VARIABLES}} + live rendering. */
import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, App, Space, Card, Drawer, Typography, Alert
} from 'antd';
import { PlusOutlined, FileSyncOutlined, EyeOutlined } from '@ant-design/icons';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader } from '../components/common.jsx';

const VARS = ['CLIENT_NAME', 'CLIENT_ADDRESS', 'CASE_NUMBER', 'CASE_TITLE', 'COURT_NAME', 'LAWYER_NAME', 'DATE', 'HEARING_DATE', 'OPPOSING_PARTY', 'WILAYA', 'COURT', 'CASE_TYPE'];

export default function Templates() {
  const { t, pick } = useI18n();
  const { can } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [renderFor, setRenderFor] = useState(null);
  const [rendered, setRendered] = useState(null);
  const [meta, setMeta] = useState({ cases: [], clients: [] });
  const [form] = Form.useForm();
  const [renderForm] = Form.useForm();

  const load = () => api('/documents/templates').then(setRows).catch(() => {});
  useEffect(() => {
    load();
    Promise.all([api('/cases?limit=200'), api('/clients?limit=200')]).then(([cases, clients]) =>
      setMeta({ cases: cases.rows, clients: clients.rows })).catch(() => {});
  }, []);

  const submit = async () => {
    const v = await form.validateFields();
    if (editing) await api(`/documents/templates/${editing.id}`, { method: 'PUT', body: v });
    else await api('/documents/templates', { method: 'POST', body: v });
    message.success(t('common.save'));
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    load();
  };

  const doRender = async () => {
    const v = await renderForm.validateFields();
    const data = await api(`/documents/templates/${renderFor.id}/render`, {
      method: 'POST',
      body: { case_id: v.case_id, client_id: v.client_id, hearing_date: v.hearing_date }
    });
    setRendered(data);
  };

  const columns = [
    { title: t('common.name'), dataIndex: 'name_fr', render: (v, r) => (
      <div>
        <b>{pick(r, 'name')}</b>
        <div style={{ fontSize: 12, color: '#8aa0b8' }}>{r.body?.slice(0, 80)}…</div>
      </div>
    ) },
    { title: t('templates.category'), dataIndex: 'category', width: 150, render: (v) => <Tag color="geekblue">{t(`templates.cat.${v}`) || v}</Tag> },
    { title: t('templates.language'), dataIndex: 'language', width: 90, render: (v) => <Tag color={v === 'ar' ? 'green' : 'blue'}>{v === 'ar' ? 'العربية' : 'Français'}</Tag> },
    {
      title: t('common.actions'), width: 220,
      render: (r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setRenderFor(r); setRendered(null); }}>{t('templates.render')}</Button>
          {can('documents.upload') && (
            <>
              <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>{t('common.edit')}</Button>
              <Button size="small" danger onClick={async () => { await api(`/documents/templates/${r.id}`, { method: 'DELETE' }); load(); }}>{t('common.delete')}</Button>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title={t('templates.title')}
        subtitle={t('templates.subtitle')}
        extra={can('documents.upload') && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>{t('templates.newTemplate')}</Button>}
      />
      <Table rowKey="id" columns={columns} dataSource={rows} size="middle" pagination={false} />

      <Modal title={editing ? t('common.edit') : t('templates.newTemplate')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')} width={720}>
        <Form form={form} layout="vertical" initialValues={{ category: 'letter', language: 'fr' }}>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="name_fr" label={t('common.name') + ' (FR)'} style={{ flex: 1 }} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="name_ar" label={t('common.name') + ' (AR)'} style={{ flex: 1 }}><Input dir="rtl" /></Form.Item>
          </Space>
          <Space>
            <Form.Item name="category" label={t('templates.category')}>
              <Select style={{ width: 220 }} options={['letter', 'client_notice', 'formal_notice', 'request', 'administrative', 'procedural', 'internal', 'invoice', 'receipt', 'meeting'].map((v) => ({ value: v, label: t(`templates.cat.${v}`) }))} />
            </Form.Item>
            <Form.Item name="language" label={t('templates.language')}>
              <Select style={{ width: 140 }} options={[{ value: 'fr', label: 'Français' }, { value: 'ar', label: 'العربية' }]} />
            </Form.Item>
          </Space>
          <div style={{ marginBottom: 8 }}>
            <b>{t('templates.variables')}:</b> {t('templates.insertVariable')}
          </div>
          <div style={{ marginBottom: 10 }}>
            {VARS.map((v) => <Tag key={v} color="gold" style={{ cursor: 'pointer' }}
              onClick={() => form.setFieldValue('body', (form.getFieldValue('body') || '') + `{{${v}}}`)}>{`{{${v}}}`}</Tag>)}
          </div>
          <Form.Item name="body" label={t('templates.body')} rules={[{ required: true }]}>
            <Input.TextArea rows={12} style={{ fontFamily: 'Consolas, monospace' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title={`${t('templates.render')} — ${renderFor ? pick(renderFor, 'name') : ''}`} open={!!renderFor} onClose={() => { setRenderFor(null); setRendered(null); }} width={640}>
        <Form form={renderForm} layout="vertical">
          <Form.Item name="case_id" label={t('templates.selectCase')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.cases.map((c) => ({ value: c.id, label: `${c.reference} — ${pick(c, 'title')}` }))} />
          </Form.Item>
          <Form.Item name="client_id" label={t('templates.selectClient')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.clients.map((c) => ({ value: c.id, label: c.legal_name || pick(c, 'full_name') || `#${c.id}` }))} />
          </Form.Item>
          <Form.Item name="hearing_date" label={t('templates.hearingDate')}><Input placeholder="JJ/MM/AAAA" /></Form.Item>
          <Button type="primary" block icon={<FileSyncOutlined />} onClick={doRender}>{t('templates.render')}</Button>
        </Form>
        {rendered && (
          <>
            <Alert type="warning" showIcon style={{ margin: '14px 0' }} message={t('templates.renderNotice')} />
            <Card size="small" title={t('templates.renderedPreview')}>
              <pre dir={renderFor?.language === 'ar' ? 'rtl' : 'ltr'} style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13 }}>{rendered.rendered}</pre>
              <Button size="small" onClick={() => { navigator.clipboard.writeText(rendered.rendered); message.success('Copied'); }}>
                Copy / نسخ
              </Button>
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
}
