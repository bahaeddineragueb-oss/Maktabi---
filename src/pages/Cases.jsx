/** Case list with filters + create/edit modal. */
import React, { useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Input, Select, Modal, Form, DatePicker, Tag, Space, App, Tooltip, Card
} from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader, PriorityTag } from '../components/common.jsx';

export default function Cases() {
  const { t, pick } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', status: '', court_id: '', practice_area_id: '', lawyer_id: '', no_activity_days: sp.get('inactive') ? '30' : '' });
  const [meta, setMeta] = useState({ statuses: [], courts: [], areas: [], users: [] });
  const [modalOpen, setModalOpen] = useState(!!sp.get('new'));
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      const data = await api(`/cases?${params}&limit=100`);
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) { message.error(t('errors.server')); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);
  useEffect(() => {
    Promise.all([
      api('/cases/statuses'), api('/directory/courts'), api('/admin/practice-areas'), api('/admin/users')
    ]).then(([statuses, courts, areas, users]) => {
      setMeta({ statuses, courts, areas: areas.filter((a) => !a.parent_id), users: users.filter((u) => u.is_active) });
    }).catch(() => {});
  }, []);

  const columns = useMemo(() => [
    {
      title: t('cases.reference'), dataIndex: 'reference', width: 110,
      render: (v, r) => <a onClick={() => nav(`/cases/${r.id}`)} style={{ fontWeight: 700 }}>{v}</a>
    },
    {
      title: t('cases.titleFr'), dataIndex: 'title_fr', ellipsis: true,
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{pick(r, 'title')}</div>
          <div style={{ fontSize: 12, color: '#8aa0b8' }}>{pick(r, 'client_name') || r.client_legal_name || r.client_commercial}</div>
        </div>
      )
    },
    {
      title: t('cases.practiceArea'), dataIndex: 'practice_area_fr', width: 160, ellipsis: true,
      render: (v, r) => pick(r, 'practice_area') || '—'
    },
    {
      title: t('cases.court'), dataIndex: 'court_name_fr', width: 180, ellipsis: true,
      render: (v, r) => (
        <div>
          <div>{pick(r, 'court_name') || '—'}</div>
          {r.chamber_name_fr && <div style={{ fontSize: 12, color: '#8aa0b8' }}>{pick(r, 'chamber_name')}</div>}
        </div>
      )
    },
    {
      title: t('common.status'), dataIndex: 'status_code', width: 130,
      render: (v, r) => <Tag color={r.status_color} style={{ margin: 0 }}>{pick(r, 'status_name')}</Tag>
    },
    { title: t('cases.priority'), dataIndex: 'priority', width: 95, render: (v) => <PriorityTag value={v} /> },
    {
      title: t('cases.nextHearing'), dataIndex: 'next_hearing_date', width: 120,
      render: (v, r) => v ? <span style={{ fontWeight: 700, color: 'var(--navy-700)' }}>{v}<br /><span className="mono" style={{ fontWeight: 400, fontSize: 12 }}>{r.next_hearing_time || ''}</span></span> : '—'
    },
    {
      title: t('cases.responsible'), dataIndex: 'lawyer_name_fr', width: 140, ellipsis: true,
      render: (v, r) => pick(r, 'lawyer_name') || '—'
    },
    { title: t('cases.documents'), dataIndex: 'documents_count', width: 80, align: 'center' },
    { title: t('cases.tasks'), dataIndex: 'open_tasks_count', width: 70, align: 'center' }
  ], [t, lang(t), pick]);

  const submit = async () => {
    const values = await form.validateFields();
    const body = {
      ...values,
      opening_date: values.opening_date ? values.opening_date.format('YYYY-MM-DD') : undefined
    };
    try {
      const res = await api('/cases', { method: 'POST', body });
      message.success(`${t('cases.reference')}: ${res.reference}`);
      setModalOpen(false);
      form.resetFields();
      load();
      nav(`/cases/${res.id}`);
    } catch (e) { message.error(e.message); }
  };

  return (
    <div>
      <PageHeader
        title={t('cases.title')}
        subtitle={t('cases.subtitle')}
        extra={can('cases.edit') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>{t('cases.newCase')}</Button>}
      />
      <Card size="small" style={{ marginBottom: 14 }}>
        <Space wrap>
          <Input
            allowClear prefix={<SearchOutlined />} placeholder={t('common.search')} style={{ width: 240 }}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
          <Select
            allowClear placeholder={t('common.status')} style={{ width: 160 }}
            options={meta.statuses.map((s) => ({ value: s.code, label: pick(s, 'name') }))}
            onChange={(v) => setFilters((f) => ({ ...f, status: v || '' }))}
          />
          <Select
            allowClear showSearch optionFilterProp="label" placeholder={t('cases.court')} style={{ width: 200 }}
            options={meta.courts.map((c) => ({ value: c.id, label: pick(c, 'name') }))}
            onChange={(v) => setFilters((f) => ({ ...f, court_id: v || '' }))}
          />
          <Select
            allowClear showSearch optionFilterProp="label" placeholder={t('cases.practiceArea')} style={{ width: 180 }}
            options={meta.areas.map((a) => ({ value: a.id, label: pick(a, 'name') }))}
            onChange={(v) => setFilters((f) => ({ ...f, practice_area_id: v || '' }))}
          />
          <Select
            allowClear showSearch optionFilterProp="label" placeholder={t('cases.responsible')} style={{ width: 160 }}
            options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))}
            onChange={(v) => setFilters((f) => ({ ...f, lawyer_id: v || '' }))}
          />
          <Select
            allowClear placeholder={t('cases.noActivityFilter')} style={{ width: 170 }}
            options={[{ value: '15', label: '15' }, { value: '30', label: '30' }, { value: '60', label: '60' }, { value: '90', label: '90' }]}
            onChange={(v) => setFilters((f) => ({ ...f, no_activity_days: v || '' }))}
          />
        </Space>
      </Card>
      <Table
        rowKey="id" loading={loading} columns={columns} dataSource={rows}
        size="middle" scroll={{ x: 1200 }}
        pagination={{ total, pageSize: 50, showTotal: (tot) => `${tot} ${t('common.results')}` }}
        onRow={(r) => ({ onClick: () => nav(`/cases/${r.id}`), style: { cursor: 'pointer' } })}
      />

      <Modal
        title={t('cases.newCase')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)}
        okText={t('common.save')} cancelText={t('common.cancel')} width={720}
      >
        <div className="disclaimer-banner" style={{ marginBottom: 12 }}>
          <span>{t('cases.runConflictCheck')} — <a onClick={() => nav('/conflict')}>{t('nav.conflict')}</a></span>
        </div>
        <Form form={form} layout="vertical" initialValues={{ priority: 'medium', opening_date: dayjs() }}>
          <Space size="middle" style={{ display: 'flex' }} align="start">
            <Form.Item name="title_fr" label={t('cases.titleFr')} style={{ flex: 1 }} rules={[{ required: true, message: t('common.required') }]}>
              <Input />
            </Form.Item>
            <Form.Item name="title_ar" label={t('cases.titleAr')} style={{ flex: 1 }}>
              <Input dir="rtl" />
            </Form.Item>
          </Space>
          <Space size="middle" style={{ display: 'flex' }} align="start">
            <Form.Item name="client_id" label={t('cases.client')} style={{ flex: 1 }} rules={[{ required: true, message: t('common.required') }]}>
              <ClientSelect />
            </Form.Item>
            <Form.Item name="opposing_party" label={t('cases.opposingParty')} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size="middle" style={{ display: 'flex' }} align="start">
            <Form.Item name="court_id" label={t('cases.court')} style={{ flex: 1 }}>
              <Select allowClear showSearch optionFilterProp="label" placeholder="—"
                options={meta.courts.map((c) => ({ value: c.id, label: pick(c, 'name') }))} />
            </Form.Item>
            <Form.Item name="practice_area_id" label={t('cases.practiceArea')} style={{ flex: 1 }}>
              <AreaSelect areas={meta.areas} />
            </Form.Item>
          </Space>
          <Space size="middle" style={{ display: 'flex' }} align="start">
            <Form.Item name="responsible_lawyer_id" label={t('cases.responsible')} style={{ flex: 1 }}>
              <Select allowClear showSearch optionFilterProp="label" placeholder="—"
                options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))} />
            </Form.Item>
            <Form.Item name="assistant_id" label={t('cases.assistant')} style={{ flex: 1 }}>
              <Select allowClear showSearch optionFilterProp="label" placeholder="—"
                options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))} />
            </Form.Item>
          </Space>
          <Space size="middle" style={{ display: 'flex' }} align="start">
            <Form.Item name="court_file_number" label={t('cases.courtFileNumber')} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="opening_date" label={t('cases.openingDate')} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="priority" label={t('cases.priority')} style={{ width: 130 }}>
              <Select options={[{ value: 'high', label: t('common.high') }, { value: 'medium', label: t('common.medium') }, { value: 'low', label: t('common.low') }]} />
            </Form.Item>
          </Space>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function lang(t) { return t('app.name'); } // re-render helper

function ClientSelect(props) {
  const { t, pick } = useI18n();
  const [options, setOptions] = useState([]);
  useEffect(() => {
    api('/clients?limit=200').then((d) =>
      setOptions(d.rows.map((c) => ({
        value: c.id,
        label: c.legal_name || c.commercial_name || pick(c, 'full_name') || `#${c.id}`
      })))
    ).catch(() => {});
  }, []);
  return <Select showSearch optionFilterProp="label" placeholder="—" options={options} style={{ width: '100%' }} {...props} />;
}

function AreaSelect({ areas }) {
  const { t, pick } = useI18n();
  const [options, setOptions] = useState([]);
  useEffect(() => {
    api('/admin/practice-areas').then((all) => {
      const flat = all.map((a) => ({ value: a.id, label: a.parent_name_fr ? `${pick(a, 'name')} — ${a.parent_name_fr}` : pick(a, 'name') }));
      setOptions(flat);
    }).catch(() => {});
  }, [areas]);
  return <Select allowClear showSearch optionFilterProp="label" placeholder="—" options={options} style={{ width: '100%' }} />;
}
