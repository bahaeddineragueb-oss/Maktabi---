/** Client registry: individuals & companies + detail drawer with cases/docs/invoices. */
import React, { useEffect, useState } from 'react';
import {
  Table, Button, Input, Select, Modal, Form, DatePicker, Tag, Space, App, Drawer,
  Descriptions, Tabs, List, Alert, Card
} from 'antd';
import { PlusOutlined, SearchOutlined, TeamOutlined, BankOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useParams } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader, DZD } from '../components/common.jsx';

export default function Clients() {
  const { t, pick } = useI18n();
  const { can } = useAuth();
  const { message } = App.useApp();
  const routeParams = useParams();
  const focusId = routeParams?.id;
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', type: '' });
  const [wilayas, setWilayas] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form] = Form.useForm();
  const [formType, setFormType] = useState('individual');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      const data = await api(`/clients?${params}&limit=100`);
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) { message.error(t('errors.server')); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);
  useEffect(() => { api('/directory/wilayas').then(setWilayas).catch(() => {}); }, []);
  useEffect(() => { if (focusId) api(`/clients/${focusId}`).then(setDetail).catch(() => {}); }, [focusId]);

  const submit = async () => {
    const v = await form.validateFields();
    const body = { ...v, date_of_birth: v.date_of_birth ? v.date_of_birth.format('YYYY-MM-DD') : undefined };
    try {
      await api('/clients', { method: 'POST', body });
      message.success(t('common.save'));
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e) { message.error(e.message); }
  };

  const clientLabel = (r) => r.legal_name || r.commercial_name || pick(r, 'full_name') || `#${r.id}`;
  const typeTag = (r) => (
    <Tag icon={r.client_type === 'company' ? <BankOutlined /> : <TeamOutlined />} color={r.client_type === 'company' ? 'geekblue' : 'green'}>
      {t(`clients.${r.client_type === 'individual' ? 'individual' : r.client_type}`)}
    </Tag>
  );

  const columns = [
    { title: t('common.name'), dataIndex: 'id', render: (v, r) => (
      <a onClick={() => api(`/clients/${v}`).then(setDetail)} style={{ fontWeight: 600 }}>{clientLabel(r)}</a>
    ) },
    { title: t('common.type'), dataIndex: 'client_type', width: 140, render: (v, r) => typeTag(r) },
    { title: t('common.phone'), dataIndex: 'phone', width: 140, render: (v) => v || '—' },
    { title: t('common.email'), dataIndex: 'email', width: 190, ellipsis: true, render: (v) => v || '—' },
    { title: t('common.wilaya'), dataIndex: 'wilaya_name_fr', width: 130, render: (v, r) => pick(r, 'wilaya_name') || '—' },
    { title: t('nav.cases'), dataIndex: 'cases_count', width: 80, align: 'center' },
    { title: t('nav.documents'), dataIndex: 'documents_count', width: 90, align: 'center' },
    { title: 'RC / NIF / NIS', dataIndex: 'rc', width: 160, render: (v, r) => r.client_type === 'company'
      ? <span className="mono">{[r.rc, r.nif, r.nis].filter(Boolean).join(' · ') || <Tag color="orange">—</Tag>}</span>
      : '—' }
  ];

  return (
    <div>
      <PageHeader
        title={t('clients.title')}
        subtitle={t('clients.subtitle')}
        extra={can('clients.edit') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>{t('clients.newClient')}</Button>}
      />
      <Card size="small" style={{ marginBottom: 14 }}>
        <Space wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder={t('common.search')} style={{ width: 260 }}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <Select allowClear placeholder={t('common.type')} style={{ width: 170 }}
            options={['individual', 'company', 'association', 'organization', 'publicEntity', 'other'].map((v) => ({ value: v, label: t(`clients.${v}`) }))}
            onChange={(v) => setFilters((f) => ({ ...f, type: v || '' }))} />
        </Space>
      </Card>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} size="middle"
        pagination={{ total, pageSize: 50, showTotal: (tot) => `${tot} ${t('common.results')}` }} />

      <Modal title={t('clients.newClient')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')} width={720}>
        <Form form={form} layout="vertical" initialValues={{ client_type: 'individual' }}>
          <Form.Item name="client_type" label={t('common.type')}>
            <Select onChange={(v) => setFormType(v)} options={['individual', 'company', 'association', 'organization', 'publicEntity', 'other'].map((v) => ({ value: v, label: t(`clients.${v}`) }))} />
          </Form.Item>
          {formType === 'individual' ? (
            <>
              <Space style={{ display: 'flex' }}>
                <Form.Item name="full_name_ar" label={t('clients.fullNameAr')} style={{ flex: 1 }} rules={[{ required: true }]}>
                  <Input dir="rtl" />
                </Form.Item>
                <Form.Item name="full_name_fr" label={t('clients.fullNameFr')} style={{ flex: 1 }} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Space>
              <Space style={{ display: 'flex' }} wrap>
                <Form.Item name="date_of_birth" label={t('clients.dob')}><DatePicker style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="place_of_birth" label={t('clients.pob')}><Input /></Form.Item>
                <Form.Item name="nationality" label={t('clients.nationality')}><Input /></Form.Item>
              </Space>
              <Form.Item name="id_number" label={t('clients.idNumber')}><Input /></Form.Item>
              <Space style={{ display: 'flex' }} wrap>
                <Form.Item name="profession" label={t('clients.profession')}><Input /></Form.Item>
                <Form.Item name="employer" label={t('clients.employer')}><Input /></Form.Item>
              </Space>
            </>
          ) : (
            <>
              <Space style={{ display: 'flex' }}>
                <Form.Item name="legal_name" label={t('clients.legalName')} style={{ flex: 1 }} rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="commercial_name" label={t('clients.commercialName')} style={{ flex: 1 }}><Input /></Form.Item>
              </Space>
              <Space style={{ display: 'flex' }} wrap>
                <Form.Item name="legal_form" label={t('clients.legalForm')}><Input placeholder="SARL, SPA, EURL…" /></Form.Item>
              </Space>
              <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('clients.identifiersMissing')} />
              <Space style={{ display: 'flex' }} wrap>
                <Form.Item name="rc" label={t('clients.rc')}><Input /></Form.Item>
                <Form.Item name="nif" label={t('clients.nif')}><Input /></Form.Item>
                <Form.Item name="nis" label={t('clients.nis')}><Input /></Form.Item>
              </Space>
            </>
          )}
          <Form.Item name="address" label={t('common.address')}><Input.TextArea rows={2} /></Form.Item>
          <Space style={{ display: 'flex' }} wrap>
            <Form.Item name="wilaya_id" label={t('common.wilaya')} style={{ minWidth: 200 }}>
              <Select allowClear showSearch optionFilterProp="label" options={wilayas.map((w) => ({ value: w.id, label: `${w.code} — ${pick(w, 'name')}` }))} />
            </Form.Item>
            <Form.Item name="municipality" label={t('common.municipality')}><Input /></Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} wrap>
            <Form.Item name="phone" label={t('common.phone')}><Input /></Form.Item>
            <Form.Item name="email" label={t('common.email')}><Input /></Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} wrap>
            <Form.Item name="emergency_contact_name" label={t('clients.emergencyContact')}><Input /></Form.Item>
            <Form.Item name="emergency_contact_phone" label={t('common.phone')}><Input /></Form.Item>
          </Space>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Drawer title={detail ? clientLabel(detail) : ''} open={!!detail} onClose={() => setDetail(null)} width={620}>
        {detail && (
          <Tabs items={[
            {
              key: 'info', label: t('common.details'),
              children: (
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label={t('common.type')}>{t(`clients.${detail.client_type === 'individual' ? 'individual' : detail.client_type}`)}</Descriptions.Item>
                  {detail.client_type === 'individual' ? (
                    <>
                      <Descriptions.Item label={t('clients.fullNameAr')}>{detail.full_name_ar}</Descriptions.Item>
                      <Descriptions.Item label={t('clients.fullNameFr')}>{detail.full_name_fr}</Descriptions.Item>
                      <Descriptions.Item label={t('clients.dob')}>{detail.date_of_birth || '—'}</Descriptions.Item>
                      <Descriptions.Item label={t('clients.pob')}>{detail.place_of_birth || '—'}</Descriptions.Item>
                      <Descriptions.Item label={t('clients.nationality')}>{detail.nationality || '—'}</Descriptions.Item>
                      <Descriptions.Item label={t('clients.idNumber')}>{detail.id_number || '—'}</Descriptions.Item>
                    </>
                  ) : (
                    <>
                      <Descriptions.Item label={t('clients.legalName')}>{detail.legal_name}</Descriptions.Item>
                      <Descriptions.Item label={t('clients.commercialName')}>{detail.commercial_name || '—'}</Descriptions.Item>
                      <Descriptions.Item label={t('clients.legalForm')}>{detail.legal_form || '—'}</Descriptions.Item>
                      <Descriptions.Item label={t('clients.rc')}>{detail.rc || '—'}</Descriptions.Item>
                      <Descriptions.Item label={t('clients.nif')}>{detail.nif || '—'}</Descriptions.Item>
                      <Descriptions.Item label={t('clients.nis')}>{detail.nis || '—'}</Descriptions.Item>
                    </>
                  )}
                  <Descriptions.Item label={t('common.address')}>{detail.address || '—'}</Descriptions.Item>
                  <Descriptions.Item label={t('common.wilaya')}>{pick(detail, 'wilaya_name') || '—'}</Descriptions.Item>
                  <Descriptions.Item label={t('common.phone')}>{detail.phone || '—'}</Descriptions.Item>
                  <Descriptions.Item label={t('common.email')}>{detail.email || '—'}</Descriptions.Item>
                  <Descriptions.Item label={t('common.notes')}>{detail.notes || '—'}</Descriptions.Item>
                </Descriptions>
              )
            },
            {
              key: 'cases', label: `${t('clients.casesOfClient')} (${detail.cases.length})`,
              children: (
                <List
                  dataSource={detail.cases} renderItem={(c) => (
                    <List.Item>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <b>{pick(c, 'title')}</b>
                          <Tag color={c.status_color}>{pick(c, 'status_name')}</Tag>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#64748b' }}>{c.reference} · {c.opening_date} · {pick(c, 'lawyer_name') || '—'}</div>
                      </div>
                    </List.Item>
                  )}
                />
              )
            },
            {
              key: 'invoices', label: `${t('clients.invoicesOfClient')} (${detail.invoices.length})`,
              children: (
                <List
                  dataSource={detail.invoices} renderItem={(i) => (
                    <List.Item>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                        <span><b>{i.number}</b> · {i.issue_date}</span>
                        <span>{DZD(i.total)} — <Tag color={i.status === 'paid' ? 'green' : 'orange'}>{i.status}</Tag></span>
                      </div>
                    </List.Item>
                  )}
                />
              )
            },
            {
              key: 'docs', label: `${t('nav.documents')} (${detail.documents.length})`,
              children: (
                <List
                  dataSource={detail.documents} renderItem={(d) => (
                    <List.Item>
                      <b>{d.title}</b> <Tag>{t(`documents.type.${d.doc_type}`) || d.doc_type}</Tag> <span style={{ color: '#8aa0b8', fontSize: 12 }}>{d.created_at?.slice(0, 10)}</span>
                    </List.Item>
                  )}
                />
              )
            }
          ]} />
        )}
      </Drawer>
    </div>
  );
}
