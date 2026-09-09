/** Professional contacts directory. */
import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Modal, Form, Tag, App, Card, Space, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader } from '../components/common.jsx';

export default function Contacts() {
  const { t, pick } = useI18n();
  const { can } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ q: '', type: '' });
  const [wilayas, setWilayas] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const data = await api(`/clients/contacts/list?${params}`);
    setRows(data.rows);
    setTotal(data.total);
  };
  useEffect(() => {
    load();
    api('/directory/wilayas').then(setWilayas).catch(() => {});
  }, [filters]);

  const submit = async () => {
    const v = await form.validateFields();
    if (editing) await api(`/clients/contacts/${editing.id}`, { method: 'PUT', body: v });
    else await api('/clients/contacts', { method: 'POST', body: v });
    message.success(t('common.save'));
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    load();
  };

  return (
    <div>
      <PageHeader
        title={t('contacts.title')}
        subtitle={t('contacts.subtitle')}
        extra={can('contacts.edit') && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>{t('contacts.newContact')}</Button>}
      />
      <Card size="small" style={{ marginBottom: 14 }}>
        <Space wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder={t('common.search')} style={{ width: 240 }}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <Select allowClear placeholder={t('common.type')} style={{ width: 160 }}
            options={['person', 'company', 'organization'].map((v) => ({ value: v, label: t(`contacts.${v}`) }))}
            onChange={(v) => setFilters((f) => ({ ...f, type: v || '' }))} />
        </Space>
      </Card>
      <Table rowKey="id" dataSource={rows} size="middle" pagination={{ total, pageSize: 50 }}
        columns={[
          { title: t('common.name'), dataIndex: 'name_fr', render: (v, r) => <div><b>{pick(r, 'name')}</b>{r.job_title && <div style={{ fontSize: 12, color: '#8aa0b8' }}>{r.job_title}</div>}</div> },
          { title: t('contacts.company'), dataIndex: 'organization' },
          { title: t('common.phone'), dataIndex: 'phone', width: 140 },
          { title: t('common.email'), dataIndex: 'email', width: 200, ellipsis: true },
          { title: t('common.wilaya'), dataIndex: 'wilaya_name_fr', width: 120 },
          {
            title: t('common.actions'), width: 130, render: (r) => can('contacts.edit') && (
              <Space>
                <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>{t('common.edit')}</Button>
                <Popconfirm title={t('common.confirmDelete')} onConfirm={async () => { await api(`/clients/contacts/${r.id}`, { method: 'DELETE' }); load(); }}>
                  <Button size="small" danger>{t('common.archive')}</Button>
                </Popconfirm>
              </Space>
            )
          }
        ]} />
      <Modal title={editing ? t('common.edit') : t('contacts.newContact')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')}>
        <Form form={form} layout="vertical" initialValues={{ contact_type: 'person' }}>
          <Form.Item name="contact_type" label={t('common.type')}>
            <Select options={['person', 'company', 'organization'].map((v) => ({ value: v, label: t(`contacts.${v}`) }))} />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="name_fr" label={t('common.name') + ' (FR)'} style={{ flex: 1 }} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="name_ar" label={t('common.name') + ' (AR)'} style={{ flex: 1 }}><Input dir="rtl" /></Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="organization" label={t('contacts.company')}><Input /></Form.Item>
            <Form.Item name="job_title" label={t('contacts.jobTitle')}><Input /></Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="phone" label={t('common.phone')}><Input /></Form.Item>
            <Form.Item name="email" label={t('common.email')}><Input /></Form.Item>
          </Space>
          <Form.Item name="address" label={t('common.address')}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="wilaya_id" label={t('common.wilaya')}>
            <Select allowClear showSearch optionFilterProp="label" options={wilayas.map((w) => ({ value: w.id, label: `${w.code} — ${pick(w, 'name')}` }))} />
          </Form.Item>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
