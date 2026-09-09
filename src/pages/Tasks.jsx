/** Tasks module. */
import React, { useEffect, useState } from 'react';
import { Table, Button, Card, Select, Input, Modal, Form, DatePicker, Tag, App, Space, Popconfirm, Badge } from 'antd';
import { PlusOutlined, SearchOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader, PriorityTag } from '../components/common.jsx';

export default function Tasks() {
  const { t, pick } = useI18n();
  const { can, user } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'open', assigned_to: '', q: '' });
  const [meta, setMeta] = useState({ cases: [], users: [] });
  const [modalOpen, setModalOpen] = useState(!!new URLSearchParams(window.location.search).get('new'));
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status === 'open') params.set('open', '1');
    else if (filters.status) params.set('status', filters.status);
    if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
    if (filters.q) params.set('q', filters.q);
    if (new URLSearchParams(window.location.search).get('overdue')) params.set('overdue', '1');
    try { setRows(await api(`/schedule/tasks?${params}`)); } catch (e) { message.error(t('errors.server')); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);
  useEffect(() => {
    Promise.all([api('/cases?limit=200'), api('/admin/users')]).then(([cases, users]) =>
      setMeta({ cases: cases.rows, users: users.filter((u) => u.is_active) })).catch(() => {});
  }, []);

  const addTask = async () => {
    const v = await form.validateFields();
    await api('/schedule/tasks', {
      method: 'POST',
      body: { ...v, due_date: v.due_date ? v.due_date.format('YYYY-MM-DD') : undefined }
    });
    message.success(t('tasks.newTask'));
    setModalOpen(false);
    form.resetFields();
    load();
  };

  const columns = [
    {
      title: t('common.name'), dataIndex: 'title',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600, textDecoration: r.status === 'done' ? 'line-through' : 'none' }}>{v}</div>
          {r.case_reference && <a style={{ fontSize: 12 }} onClick={() => nav(`/cases/${r.case_id}`)}>{r.case_reference} — {pick(r, 'case_title')}</a>}
        </div>
      )
    },
    {
      title: t('tasks.dueDate'), dataIndex: 'due_date', width: 115, sorter: (a, b) => (a.due_date || '').localeCompare(b.due_date || ''),
      render: (v, r) => {
        const late = v && r.status !== 'done' && dayjs(v).isBefore(dayjs(), 'day');
        return <b style={{ color: late ? '#c0392b' : undefined }}>{v || '—'}</b>;
      }
    },
    { title: t('cases.priority'), dataIndex: 'priority', width: 90, render: (v) => <PriorityTag value={v} /> },
    {
      title: t('common.status'), dataIndex: 'status', width: 110,
      render: (v) => <Tag color={v === 'done' ? 'green' : v === 'in_progress' ? 'blue' : 'default'}>{t(`tasks.status${v === 'todo' ? 'Todo' : v === 'in_progress' ? 'InProgress' : v === 'done' ? 'Done' : 'Cancelled'}`)}</Tag>
    },
    { title: t('tasks.assignee'), dataIndex: 'assignee_name_fr', width: 150, ellipsis: true, render: (v, r) => pick(r, 'assignee_name') || '—' },
    {
      title: t('common.actions'), width: 120,
      render: (r) => (
        <Space>
          {can('tasks.edit') && r.status !== 'done' && (
            <>
              <Popconfirm title={t('common.confirm')} onConfirm={async () => { await api(`/schedule/tasks/${r.id}`, { method: 'PUT', body: { status: 'done' } }); load(); }}>
                <Button size="small" icon={<CheckOutlined />} />
              </Popconfirm>
              <Button size="small" onClick={async () => { await api(`/schedule/tasks/${r.id}`, { method: 'PUT', body: { status: 'in_progress' } }); load(); }}>
                {t('tasks.statusInProgress')}
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  const counts = {
    open: rows.filter((r) => r.status !== 'done' && r.status !== 'cancelled').length,
    overdue: rows.filter((r) => r.due_date && r.status !== 'done' && dayjs(r.due_date).isBefore(dayjs(), 'day')).length
  };

  return (
    <div>
      <PageHeader
        title={t('tasks.title')}
        subtitle={t('tasks.subtitle')}
        extra={can('tasks.edit') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>{t('tasks.newTask')}</Button>}
      />
      <Card size="small" style={{ marginBottom: 14 }}>
        <Space wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder={t('common.search')} style={{ width: 220 }}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <Select value={filters.status} style={{ width: 140 }} onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={[
              { value: 'open', label: t('tasks.open') },
              { value: '', label: t('common.all') },
              { value: 'todo', label: t('tasks.statusTodo') },
              { value: 'in_progress', label: t('tasks.statusInProgress') },
              { value: 'done', label: t('tasks.statusDone') }
            ]} />
          <Select allowClear placeholder={t('tasks.assignee')} style={{ width: 170 }} showSearch optionFilterProp="label"
            options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))}
            onChange={(v) => setFilters((f) => ({ ...f, assigned_to: v || '' }))} />
          <Badge count={counts.overdue} style={{ backgroundColor: '#c0392b' }}><span style={{ padding: '0 6px' }}>{t('common.overdue')}</span></Badge>
        </Space>
      </Card>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} size="middle" pagination={{ pageSize: 50 }} />

      <Modal title={t('tasks.newTask')} open={modalOpen} onOk={addTask} onCancel={() => setModalOpen(false)} okText={t('common.save')}>
        <Form form={form} layout="vertical" initialValues={{ priority: 'medium', assigned_to: user?.id }}>
          <Form.Item name="title" label={t('common.name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label={t('common.description')}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="case_id" label={t('common.case')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.cases.map((c) => ({ value: c.id, label: `${c.reference} — ${pick(c, 'title')}` }))} />
          </Form.Item>
          <Space>
            <Form.Item name="due_date" label={t('tasks.dueDate')}><DatePicker /></Form.Item>
            <Form.Item name="assigned_to" label={t('tasks.assignee')}>
              <Select allowClear showSearch optionFilterProp="label" style={{ width: 200 }} options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))} />
            </Form.Item>
            <Form.Item name="priority" label={t('cases.priority')}>
              <Select style={{ width: 130 }} options={['high', 'medium', 'low'].map((v) => ({ value: v, label: t(`common.${v}`) }))} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
