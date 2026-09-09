/** Procedural deadlines: list + calculation engine + rules management. */
import React, { useEffect, useState } from 'react';
import {
  Table, Button, Card, Select, Input, InputNumber, DatePicker, Modal, Form, App,
  Tag, Space, Alert, Popconfirm, Statistic, Row, Col, Tooltip, Drawer
} from 'antd';
import { PlusOutlined, CalculatorOutlined, WarningOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader, PriorityTag, VerifyBadge } from '../components/common.jsx';

export default function Deadlines() {
  const { t, pick } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'active', priority: '', q: '' });
  const [engineOpen, setEngineOpen] = useState(false);
  const [engineResult, setEngineResult] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [meta, setMeta] = useState({ cases: [], users: [] });
  const [engineForm] = Form.useForm();
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try { setRows(await api(`/schedule/deadlines?${params}`)); } catch (e) { message.error(t('errors.server')); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);
  useEffect(() => {
    api('/schedule/deadline-rules').then(setRules).catch(() => {});
    Promise.all([api('/cases?limit=200'), api('/admin/users')]).then(([cases, users]) =>
      setMeta({ cases: cases.rows, users: users.filter((u) => u.is_active) })).catch(() => {});
  }, []);

  const compute = async () => {
    const v = await engineForm.validateFields();
    const data = await api('/schedule/deadlines/preview', {
      method: 'POST',
      body: { ...v, start_date: v.start_date.format('YYYY-MM-DD') }
    });
    setEngineResult(data);
  };

  const addDeadline = async () => {
    const v = await form.validateFields();
    const body = {
      ...v,
      case_id: v.case_id || undefined,
      start_date: v.start_date ? v.start_date.format('YYYY-MM-DD') : undefined
    };
    if (v.end_date) body.end_date = v.end_date.format('YYYY-MM-DD');
    await api('/schedule/deadlines', { method: 'POST', body });
    message.success(t('deadlines.newDeadline'));
    setNewOpen(false);
    form.resetFields();
    load();
  };

  const overdue = rows.filter((r) => r.status === 'active' && dayjs(r.end_date).isBefore(dayjs(), 'day')).length;

  const columns = [
    { title: t('deadlines.title'), dataIndex: 'title_fr', render: (v, r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{pick(r, 'title')}</div>
        <div style={{ fontSize: 12, color: '#8aa0b8' }}>
          {r.case_reference && <a onClick={() => nav(`/cases/${r.case_id}`)}>{r.case_reference}</a>}
          {r.is_computed ? ' · ⚠️ auto' : ''} {r.legal_basis ? ` · ${r.legal_basis}` : ''}
        </div>
      </div>
    ) },
    { title: t('common.date'), dataIndex: 'end_date', width: 120, sorter: (a, b) => a.end_date?.localeCompare(b.end_date),
      render: (v, r) => {
        const late = r.status === 'active' && dayjs(v).isBefore(dayjs(), 'day');
        return <b style={{ color: late ? '#c0392b' : 'var(--navy-700)' }}>{v}</b>;
      } },
    { title: t('cases.priority'), dataIndex: 'priority', width: 95, render: (v) => <PriorityTag value={v} /> },
    { title: t('common.status'), dataIndex: 'status', width: 110,
      render: (v) => <Tag color={v === 'done' ? 'green' : v === 'suspended' ? 'default' : 'blue'}>{t(`deadlines.status${v[0].toUpperCase() + v.slice(1)}`)}</Tag> },
    { title: t('library.verification'), dataIndex: 'verification_status', width: 130, render: (v) => <VerifyBadge status={v} /> },
    { title: t('cases.responsible'), dataIndex: 'lawyer_name_fr', width: 140, ellipsis: true, render: (v, r) => pick(r, 'lawyer_name') || '—' },
    {
      title: t('common.actions'), width: 130,
      render: (r) => (
        <Space>
          {r.status === 'active' && can('deadlines.edit') && (
            <Popconfirm title={t('common.confirm')} onConfirm={async () => { await api(`/schedule/deadlines/${r.id}/complete`, { method: 'PUT' }); load(); }}>
              <Button size="small" icon={<CheckOutlined />}>{t('deadlines.markDone')}</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title={t('deadlines.title')}
        subtitle={t('deadlines.subtitle')}
        extra={
          <>
            <Button icon={<CalculatorOutlined />} onClick={() => setEngineOpen(true)}>{t('deadlines.engine')}</Button>
            <Button onClick={() => setRulesOpen(true)}>{t('deadlines.rules')}</Button>
            {can('deadlines.edit') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>{t('deadlines.newDeadline')}</Button>}
          </>
        }
      />
      <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ marginBottom: 14 }} message={t('deadlines.autoWarning')} />
      <Row gutter={14} style={{ marginBottom: 14 }}>
        <Col xs={8} md={5}><Card size="small"><Statistic title={t('dashboard.activeDeadlines')} value={rows.filter((r) => r.status === 'active').length} /></Card></Col>
        <Col xs={8} md={5}><Card size="small"><Statistic title={t('common.overdue')} value={overdue} valueStyle={{ color: '#c0392b' }} /></Card></Col>
        <Col xs={8} md={5}><Card size="small"><Statistic title={t('deadlines.statusDone')} value={rows.filter((r) => r.status === 'done').length} valueStyle={{ color: '#2e7d32' }} /></Card></Col>
      </Row>
      <Card size="small" style={{ marginBottom: 14 }}>
        <Space wrap>
          <Input allowClear placeholder={t('common.search')} style={{ width: 220 }}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <Select value={filters.status} style={{ width: 150 }} onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={[{ value: '', label: t('common.all') }, { value: 'active', label: t('deadlines.statusActive') }, { value: 'done', label: t('deadlines.statusDone') }, { value: 'suspended', label: t('deadlines.statusSuspended') }]} />
          <Select allowClear placeholder={t('cases.priority')} style={{ width: 130 }}
            options={['high', 'medium', 'low'].map((v) => ({ value: v, label: t(`common.${v}`) }))}
            onChange={(v) => setFilters((f) => ({ ...f, priority: v || '' }))} />
        </Space>
      </Card>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} size="middle" pagination={{ pageSize: 50 }} />

      {/* Calculator */}
      <Modal title={t('deadlines.engine')} open={engineOpen} footer={null} onCancel={() => { setEngineOpen(false); setEngineResult(null); }} width={560}>
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('deadlines.unverifiedRule')} />
        <Form form={engineForm} layout="vertical" initialValues={{ day_type: 'calendar', unit: 'day', amount: 15, start_date: dayjs(), holiday_exclusion: false }}>
          <Form.Item name="rule_id" label={t('deadlines.rule')}>
            <Select allowClear placeholder={t('deadlines.manualRule')}
              options={rules.map((r) => ({ value: r.id, label: `${pick(r, 'name')} ${r.verified ? '✓' : '⚠️'}` }))} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="start_date" label={t('deadlines.startDate')} rules={[{ required: true }]}><DatePicker /></Form.Item>
            <Form.Item name="amount" label={t('deadlines.amount')}><InputNumber min={1} style={{ width: 110 }} /></Form.Item>
            <Form.Item name="unit" label="&nbsp;">
              <Select style={{ width: 110 }} options={[{ value: 'day', label: t('deadlines.days') }, { value: 'month', label: t('deadlines.months') }]} />
            </Form.Item>
            <Form.Item name="day_type" label="&nbsp;">
              <Select style={{ width: 190 }} options={[
                { value: 'calendar', label: t('deadlines.calendar') },
                { value: 'business', label: t('deadlines.business') },
                { value: 'legal', label: t('deadlines.legal') }
              ]} />
            </Form.Item>
            <Form.Item name="holiday_exclusion" valuePropName="checked" label="&nbsp;">
              <Select style={{ width: 190 }} options={[{ value: false, label: t('common.no') }, { value: true, label: t('deadlines.holidayExclusion') }]} />
            </Form.Item>
          </Space>
          <Button type="primary" icon={<CalculatorOutlined />} onClick={compute} block>{t('deadlines.compute')}</Button>
        </Form>
        {engineResult && (
          <Card size="small" style={{ marginTop: 14, background: '#faf3dd' }}>
            <Statistic title={t('deadlines.computedEnd')} value={engineResult.end_date} />
            <div style={{ fontSize: 12.5, color: '#6b5b1e', marginTop: 6 }}>
              {engineResult.excluded_days} {t('deadlines.excludedDays')}
            </div>
            <Alert style={{ marginTop: 10 }} type="warning" message={t('deadlines.autoWarning')} />
          </Card>
        )}
      </Modal>

      {/* New deadline */}
      <Modal title={t('deadlines.newDeadline')} open={newOpen} onOk={addDeadline} onCancel={() => setNewOpen(false)} okText={t('common.save')} width={600}>
        <Form form={form} layout="vertical" initialValues={{ priority: 'high', unit: 'day', day_type: 'calendar' }}>
          <Form.Item name="title_fr" label={t('common.description')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="case_id" label={t('common.case')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.cases.map((c) => ({ value: c.id, label: `${c.reference} — ${pick(c, 'title')}` }))} />
          </Form.Item>
          <Form.Item name="rule_id" label={t('deadlines.rule')}>
            <Select allowClear placeholder={t('deadlines.manualRule')} options={rules.map((r) => ({ value: r.id, label: `${pick(r, 'name')} ${r.verified ? '✓' : '⚠️'}` }))} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="start_date" label={t('deadlines.startDate')}><DatePicker /></Form.Item>
            <Form.Item name="amount" label={t('deadlines.amount')}><InputNumber min={1} /></Form.Item>
            <Form.Item name="end_date" label={t('common.date')}><DatePicker /></Form.Item>
          </Space>
          <Form.Item name="legal_basis" label={t('deadlines.legalBasis')}><Input placeholder="Art. … (loi n° …)" /></Form.Item>
          <Form.Item name="priority" label={t('cases.priority')}>
            <Select options={['high', 'medium', 'low'].map((v) => ({ value: v, label: t(`common.${v}`) }))} />
          </Form.Item>
          <Form.Item name="responsible_lawyer_id" label={t('cases.responsible')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))} />
          </Form.Item>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Rules manager */}
      <Drawer title={t('deadlines.rulesSubtitle')} open={rulesOpen} onClose={() => setRulesOpen(false)} width={680}>
        <Table
          rowKey="id" size="small" dataSource={rules} pagination={false}
          columns={[
            { title: t('common.name'), dataIndex: 'name_fr', render: (v, r) => <div><b>{pick(r, 'name')}</b><div style={{ fontSize: 12, color: '#8aa0b8' }}>{r.description}</div></div> },
            { title: t('deadlines.amount'), width: 100, render: (r) => `${r.amount} ${r.unit === 'month' ? t('deadlines.months') : t('deadlines.days')}` },
            { title: t('deadlines.dayType'), dataIndex: 'day_type', width: 110, render: (v) => t(`deadlines.${v}`) },
            { title: t('deadlines.legalBasis'), dataIndex: 'legal_basis', width: 130, render: (v) => v || '—' },
            { title: t('library.verification'), dataIndex: 'verified', width: 110, render: (v) => v ? <Tag color="green">{t('deadlines.verified')}</Tag> : <Tag color="red">{t('deadlines.unverified')}</Tag> }
          ]}
        />
      </Drawer>
    </div>
  );
}
