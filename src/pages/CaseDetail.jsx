/** Case detail: overview, timeline, hearings, deadlines, tasks, documents, finance. */
import React, { useEffect, useState } from 'react';
import {
  Tabs, Descriptions, Tag, Button, Timeline, List, Modal, Form, Input, Select, DatePicker,
  App, Empty, Popconfirm, Drawer, Space, Typography, Table, Alert
} from 'antd';
import { PlusOutlined, EditOutlined, SoundOutlined, FieldTimeOutlined, CheckSquareOutlined, FileTextOutlined, PrinterOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api, download } from '../api.js';
import { PageHeader, PriorityTag, VerifyBadge, DZD, hearingTypeOptions } from '../components/common.jsx';

export default function CaseDetail() {
  const { id } = useParams();
  const { t, lang, pick } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({ statuses: [], courts: [], areas: [], users: [] });
  const [editOpen, setEditOpen] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [hearingModal, setHearingModal] = useState(false);
  const [deadlineModal, setDeadlineModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [outcomeModal, setOutcomeModal] = useState(null);
  const [form] = Form.useForm();
  const [hearingForm] = Form.useForm();
  const [deadlineForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [eventForm] = Form.useForm();
  const [outcomeForm] = Form.useForm();
  const [rules, setRules] = useState([]);

  const load = () => api(`/cases/${id}`).then(setData).catch(() => nav('/cases'));
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    Promise.all([api('/cases/statuses'), api('/directory/courts'), api('/admin/practice-areas'), api('/admin/users'), api('/schedule/deadline-rules')])
      .then(([statuses, courts, areas, users, rules]) => {
        setMeta({ statuses, courts, areas, users: users.filter((u) => u.is_active) });
        setRules(rules);
      }).catch(() => {});
  }, []);

  if (!data) return null;

  const clientName = data.client_legal_name || data.client_commercial || pick(data, 'client_name');

  const saveEdit = async () => {
    const v = await form.validateFields();
    await api(`/cases/${id}`, { method: 'PUT', body: { ...v } });
    message.success(t('common.save'));
    setEditOpen(false);
    load();
  };

  const addHearing = async () => {
    const v = await hearingForm.validateFields();
    await api('/schedule/hearings', {
      method: 'POST',
      body: { ...v, case_id: Number(id), date: v.date.format('YYYY-MM-DD') }
    });
    message.success(t('hearings.newHearing'));
    setHearingModal(false);
    hearingForm.resetFields();
    load();
  };

  const addDeadline = async () => {
    const v = await deadlineForm.validateFields();
    await api('/schedule/deadlines', {
      method: 'POST',
      body: {
        ...v, case_id: Number(id),
        start_date: v.start_date ? v.start_date.format('YYYY-MM-DD') : undefined
      }
    });
    message.success(t('deadlines.newDeadline'));
    setDeadlineModal(false);
    deadlineForm.resetFields();
    load();
  };

  const addTask = async () => {
    const v = await taskForm.validateFields();
    await api('/schedule/tasks', {
      method: 'POST',
      body: { ...v, case_id: Number(id), due_date: v.due_date ? v.due_date.format('YYYY-MM-DD') : undefined }
    });
    message.success(t('tasks.newTask'));
    setTaskModal(false);
    taskForm.resetFields();
    load();
  };

  const addEvent = async () => {
    const v = await eventForm.validateFields();
    await api(`/cases/${id}/events`, {
      method: 'POST',
      body: { ...v, event_date: v.event_date.format('YYYY-MM-DD') }
    });
    setEventModal(false);
    eventForm.resetFields();
    load();
  };

  const saveOutcome = async () => {
    const v = await outcomeModal.values;
    const body = await outcomeModal.form.validateFields();
    await api(`/schedule/hearings/${outcomeModal.hearing.id}/outcome`, {
      method: 'PUT',
      body: {
        ...body,
        next_date: body.next_date ? body.next_date.format('YYYY-MM-DD') : null
      }
    });
    message.success(t('hearings.recordOutcome'));
    setOutcomeModal(null);
    load();
  };

  const EVENT_COLORS = { consultation: 'blue', document: 'cyan', filing: 'geekblue', hearing: 'purple', deadline: 'red', task: 'orange', note: 'gray', status: 'gold', event: 'green', creation: 'green', archive: 'default' };

  const tabItems = [
    {
      key: 'overview', label: t('cases.overview'),
      children: (
        <div>
          <Descriptions bordered size="small" column={{ xs: 1, md: 2, xl: 3 }}>
            <Descriptions.Item label={t('cases.client')}>{clientName || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.opposingParty')}>{data.opposing_party || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.opposingLawyer')}>{data.opposing_lawyer || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.court')}>{pick(data, 'court_name') || '—'}{data.chamber_name_fr ? ` · ${pick(data, 'chamber_name')}` : ''}</Descriptions.Item>
            <Descriptions.Item label={t('cases.practiceArea')}>{pick(data, 'practice_area') || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.jurisdiction')}>{data.jurisdiction || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.openingDate')}>{data.opening_date}</Descriptions.Item>
            <Descriptions.Item label={t('cases.closingDate')}>{data.closing_date || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.nextHearing')}>{data.next_hearing_date || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.nextAction')}>{data.next_action || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.lastAction')}>{data.last_action_at?.slice(0, 16).replace('T', ' ') || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.responsible')}>{pick(data, 'lawyer_name') || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.assistant')}>{pick(data, 'assistant_name') || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('cases.team')}>
              {data.team.length ? data.team.map((u) => <Tag key={u.id}>{pick(u, 'full_name')}</Tag>) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('cases.courtFileNumber')}>{data.court_file_number || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('common.notes')} span={3}>{data.notes || '—'}</Descriptions.Item>
          </Descriptions>
        </div>
      )
    },
    {
      key: 'timeline', label: t('cases.timeline'),
      children: (
        <div style={{ maxWidth: 760 }}>
          {data.timeline.length === 0 && <Empty />}
          <Timeline
            mode="left"
            items={data.timeline.map((e) => ({
              color: EVENT_COLORS[e.event_type] === 'red' ? 'red' : EVENT_COLORS[e.event_type] === 'green' ? 'green' : 'blue',
              label: <span className="timeline-date">{e.event_date} {e.event_time}</span>,
              children: (
                <div>
                  <Tag color={EVENT_COLORS[e.event_type]}>{t(`event.${e.event_type}`) || e.event_type}</Tag>
                  <div className="timeline-desc" style={{ margin: '4px 0' }}>{e.description}</div>
                  <div className="timeline-user">{e.user_name_fr || '—'}</div>
                </div>
              )
            }))}
          />
        </div>
      )
    },
    {
      key: 'hearings', label: `${t('cases.hearings')} (${data.hearings.length})`,
      children: (
        <List
          dataSource={data.hearings}
          renderItem={(h) => (
            <List.Item
              actions={can('hearings.edit') && h.status === 'scheduled' ? [
                <Button key="oc" size="small" type="primary" ghost onClick={() => { outcomeForm.setFieldsValue({ outcome: h.outcome, adjournment_reason: h.adjournment_reason }); setOutcomeModal(h); }}>{t('hearings.recordOutcome')}</Button>
              ] : undefined}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <b style={{ color: 'var(--navy-700)' }}>{h.date} {h.time}</b>
                  <Tag color={h.status === 'held' ? 'green' : h.status === 'cancelled' ? 'default' : 'geekblue'}>{t(`hearings.status${h.status === 'scheduled' ? 'Scheduled' : h.status === 'held' ? 'Held' : 'Cancelled'}`)}</Tag>
                  <Tag>{t(`hearings.type.${h.hearing_type}`) || h.hearing_type}</Tag>
                  {h.room && <Tag color="gold">{t('hearings.room')}: {h.room}</Tag>}
                </div>
                <div style={{ margin: '6px 0', color: '#475569' }}>{pick(h, 'court_name')} {h.chamber_name_fr && `· ${h.chamber_name_fr}`} · {pick(h, 'lawyer_name') || '—'}</div>
                {h.purpose && <div><b>{t('hearings.purpose')}:</b> {h.purpose}</div>}
                {h.required_documents && <div style={{ fontSize: 12.5 }}><b>{t('hearings.requiredDocuments')}:</b> {h.required_documents}</div>}
                {h.outcome && <Alert style={{ marginTop: 8 }} type={h.outcome.toLowerCase().includes('renvoi') ? 'warning' : 'success'} message={`${t('hearings.outcome')}: ${h.outcome}${h.adjournment_reason ? ` (${h.adjournment_reason})` : ''}${h.next_date ? ` → ${h.next_date}` : ''}`} />}
              </div>
            </List.Item>
          )}
        />
      )
    },
    {
      key: 'deadlines', label: `${t('cases.deadlines')} (${data.deadlines.length})`,
      children: (
        <List
          dataSource={data.deadlines}
          renderItem={(d) => (
            <List.Item actions={can('deadlines.edit') && d.status === 'active' ? [
              <Popconfirm key="done" title={t('common.confirm')} onConfirm={async () => { await api(`/schedule/deadlines/${d.id}/complete`, { method: 'PUT' }); load(); }}>
                <Button size="small" type="primary" ghost>{t('deadlines.markDone')}</Button>
              </Popconfirm>
            ] : undefined}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ color: dayjs(d.end_date).isBefore(dayjs(), 'day') ? '#c0392b' : 'var(--navy-700)' }}>{d.end_date}</b>
                  <PriorityTag value={d.priority} />
                  <Tag color={d.status === 'done' ? 'green' : d.status === 'suspended' ? 'default' : 'blue'}>{t(`deadlines.status${d.status ? d.status[0].toUpperCase() + d.status.slice(1) : 'Active'}`)}</Tag>
                  {d.is_computed && <Tag color="orange">⚠️ {t('deadlines.autoWarning')}</Tag>}
                </div>
                <div style={{ margin: '4px 0' }}>{pick(d, 'title')}</div>
                <Space size={6} wrap>
                  <VerifyBadge status={d.verification_status} />
                  {d.legal_basis && <Tag>{t('deadlines.legalBasis')}: {d.legal_basis}</Tag>}
                  {d.lawyer_name_fr && <Tag>{d.lawyer_name_fr}</Tag>}
                </Space>
              </div>
            </List.Item>
          )}
        />
      )
    },
    {
      key: 'tasks', label: `${t('cases.tasks')} (${data.tasks.length})`,
      children: (
        <List
          dataSource={data.tasks}
          renderItem={(task) => (
            <List.Item actions={can('tasks.edit') && task.status !== 'done' ? [
              <Popconfirm key="d" title={t('common.confirm')} onConfirm={async () => { await api(`/schedule/tasks/${task.id}`, { method: 'PUT', body: { status: 'done' } }); load(); }}>
                <Button size="small" type="primary" ghost>{t('tasks.markDone')}</Button>
              </Popconfirm>
            ] : undefined}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <b style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</b>
                  <Tag color={task.status === 'done' ? 'green' : task.status === 'in_progress' ? 'blue' : 'default'}>{t(`tasks.status${task.status === 'todo' ? 'Todo' : task.status === 'in_progress' ? 'InProgress' : task.status === 'done' ? 'Done' : 'Cancelled'}`)}</Tag>
                  <PriorityTag value={task.priority} />
                </div>
                <div style={{ fontSize: 12.5, color: '#64748b' }}>{t('tasks.assignee')}: {pick(task, 'assignee_name') || '—'} · {t('tasks.dueDate')}: {task.due_date || '—'}</div>
                {task.description && <div style={{ color: '#475569' }}>{task.description}</div>}
              </div>
            </List.Item>
          )}
        />
      )
    },
    {
      key: 'documents', label: `${t('cases.documents')} (${data.documents.length})`,
      children: (
        <Table
          rowKey="id" size="small" dataSource={data.documents}
          columns={[
            { title: t('common.name'), dataIndex: 'title', render: (v, r) => <b>{v}</b> },
            { title: t('documents.docType'), dataIndex: 'doc_type', render: (v) => t(`documents.type.${v}`) || v },
            { title: t('documents.version'), dataIndex: 'version', width: 80, render: (v) => `v${v}` },
            { title: t('common.created'), dataIndex: 'created_at', render: (v) => v?.slice(0, 10) },
            {
              title: '', width: 90, render: (r) => r.file_path
                ? <Button size="small" icon={<FileTextOutlined />} onClick={(e) => { e.stopPropagation(); download(`/documents/${r.id}/download`, r.original_name); }}>{t('common.download')}</Button>
                : <Tag>{t('documents.metadataOnly')}</Tag>
            }
          ]}
          pagination={false}
        />
      )
    },
    {
      key: 'finance', label: `${t('cases.finance')}`,
      children: (
        <div>
          <Typography.Title level={5}>{t('finance.invoices')}</Typography.Title>
          <Table
            rowKey="id" size="small" dataSource={data.invoices} pagination={false} style={{ marginBottom: 20 }}
            columns={[
              { title: t('finance.invoiceNumber'), dataIndex: 'number' },
              { title: t('finance.issueDate'), dataIndex: 'issue_date' },
              { title: t('common.status'), dataIndex: 'status', render: (v) => <Tag color={v === 'paid' ? 'green' : v === 'partial' ? 'orange' : v === 'draft' ? 'default' : 'blue'}>{t(`finance.status${v[0].toUpperCase() + v.slice(1)}`)}</Tag> },
              { title: t('finance.totalTTC'), dataIndex: 'total', render: DZD },
              { title: t('finance.paid'), dataIndex: 'paid_amount', render: DZD },
              { title: t('finance.balance'), render: (r) => <b style={{ color: r.total > r.paid_amount ? '#c0392b' : '#2e7d32' }}>{DZD(r.total - r.paid_amount)}</b> }
            ]}
          />
          <Typography.Title level={5}>{t('finance.expenses')}</Typography.Title>
          <Table
            rowKey="id" size="small" dataSource={data.expenses} pagination={false}
            columns={[
              { title: t('common.date'), dataIndex: 'date' },
              { title: t('finance.expenseCategory'), dataIndex: 'category' },
              { title: t('common.description'), dataIndex: 'description' },
              { title: t('common.amount'), dataIndex: 'amount', render: DZD },
              { title: t('finance.reimbursable'), dataIndex: 'reimbursable', render: (v) => (v ? t('common.yes') : t('common.no')) }
            ]}
          />
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title={
          <span>
            <span className="bar" />
            <Tag color={data.status_color} style={{ fontSize: 14 }}>{pick(data, 'status_name')}</Tag>
            {pick(data, 'title')}
          </span>
        }
        subtitle={`${data.reference} · ${clientName || ''} · ${t('cases.openingDate')}: ${data.opening_date}`}
        extra={
          <>
            {can('cases.edit') && <Button icon={<EditOutlined />} onClick={() => { form.setFieldsValue({ ...data, opening_date: data.opening_date ? dayjs(data.opening_date) : null }); setEditOpen(true); }}>{t('common.edit')}</Button>}
            {can('cases.edit') && <Button icon={<PrinterOutlined />} onClick={() => window.print()}>{t('common.print')}</Button>}
            {can('hearings.edit') && <Button icon={<SoundOutlined />} onClick={() => setHearingModal(true)}>{t('dashboard.newHearing')}</Button>}
            {can('deadlines.edit') && <Button icon={<FieldTimeOutlined />} onClick={() => setDeadlineModal(true)}>{t('deadlines.newDeadline')}</Button>}
            {can('tasks.edit') && <Button icon={<CheckSquareOutlined />} onClick={() => setTaskModal(true)}>{t('dashboard.newTask')}</Button>}
            {can('cases.edit') && <Button icon={<PlusOutlined />} onClick={() => setEventModal(true)}>{t('cases.addEvent')}</Button>}
            {can('cases.edit') && (
              <Popconfirm title={t('common.confirm')} onConfirm={async () => { await api(`/cases/${id}/archive`, { method: 'PUT' }); nav('/cases'); }}>
                <Button danger>{t('common.archive')}</Button>
              </Popconfirm>
            )}
          </>
        }
      />
      <Tabs items={tabItems} defaultActiveKey="overview" />

      {/* Edit drawer */}
      <Drawer title={t('cases.editCase')} open={editOpen} onClose={() => setEditOpen(false)} width={640} extra={<Button type="primary" onClick={saveEdit}>{t('common.save')}</Button>}>
        <Form form={form} layout="vertical">
          <Form.Item name="title_fr" label={t('cases.titleFr')}><Input /></Form.Item>
          <Form.Item name="title_ar" label={t('cases.titleAr')}><Input dir="rtl" /></Form.Item>
          <Form.Item name="status_id" label={t('common.status')}>
            <Select options={meta.statuses.map((s) => ({ value: s.id, label: pick(s, 'name') }))} />
          </Form.Item>
          <Form.Item name="opposing_party" label={t('cases.opposingParty')}><Input /></Form.Item>
          <Form.Item name="opposing_lawyer" label={t('cases.opposingLawyer')}><Input /></Form.Item>
          <Form.Item name="court_id" label={t('cases.court')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.courts.map((c) => ({ value: c.id, label: pick(c, 'name') }))} />
          </Form.Item>
          <Form.Item name="practice_area_id" label={t('cases.practiceArea')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.areas.map((a) => ({ value: a.id, label: a.parent_name_fr ? `${pick(a, 'name')} — ${a.parent_name_fr}` : pick(a, 'name') }))} />
          </Form.Item>
          <Form.Item name="responsible_lawyer_id" label={t('cases.responsible')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))} />
          </Form.Item>
          <Form.Item name="court_file_number" label={t('cases.courtFileNumber')}><Input /></Form.Item>
          <Form.Item name="judge" label={t('cases.judge')}><Input /></Form.Item>
          <Form.Item name="jurisdiction" label={t('cases.jurisdiction')}><Input /></Form.Item>
          <Form.Item name="priority" label={t('cases.priority')}>
            <Select options={[{ value: 'high', label: t('common.high') }, { value: 'medium', label: t('common.medium') }, { value: 'low', label: t('common.low') }]} />
          </Form.Item>
          <Form.Item name="opening_date" label={t('cases.openingDate')}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="closing_date" label={t('cases.closingDate')}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="next_action" label={t('cases.nextAction')}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Drawer>

      {/* hearing modal */}
      <Modal title={t('hearings.newHearing')} open={hearingModal} onOk={addHearing} onCancel={() => setHearingModal(false)} okText={t('common.save')}>
        <Form form={hearingForm} layout="vertical" initialValues={{ hearing_type: 'civil', time: '09:00' }}>
          <Form.Item name="date" label={t('common.date')} rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="time" label={t('common.time')}><Input type="time" /></Form.Item>
          <Form.Item name="hearing_type" label={t('hearings.hearingType')}>
            <Select options={hearingTypeOptions(t)} />
          </Form.Item>
          <Form.Item name="court_id" label={t('cases.court')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.courts.map((c) => ({ value: c.id, label: pick(c, 'name') }))} />
          </Form.Item>
          <Form.Item name="lawyer_id" label={t('cases.responsible')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))} />
          </Form.Item>
          <Form.Item name="room" label={t('hearings.room')}><Input /></Form.Item>
          <Form.Item name="purpose" label={t('hearings.purpose')}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="required_documents" label={t('hearings.requiredDocuments')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* deadline modal */}
      <Modal title={t('deadlines.newDeadline')} open={deadlineModal} onOk={addDeadline} onCancel={() => setDeadlineModal(false)} okText={t('common.save')} width={560}>
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('deadlines.autoWarning')} />
        <Form form={deadlineForm} layout="vertical" initialValues={{ priority: 'high', unit: 'day', day_type: 'calendar' }}>
          <Form.Item name="title_fr" label={t('common.description')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="rule_id" label={t('deadlines.rule')}>
            <Select
              allowClear placeholder={t('deadlines.manualRule')}
              options={rules.map((r) => ({ value: r.id, label: `${pick(r, 'name')} ${r.verified ? '✓' : '⚠️'}` }))}
            />
          </Form.Item>
          <Space>
            <Form.Item name="start_date" label={t('deadlines.startDate')}><DatePicker /></Form.Item>
            <Form.Item name="amount" label={t('deadlines.amount')}><Input type="number" style={{ width: 110 }} /></Form.Item>
            <Form.Item name="unit" label="&nbsp;">
              <Select style={{ width: 110 }} options={[{ value: 'day', label: t('deadlines.days') }, { value: 'month', label: t('deadlines.months') }]} />
            </Form.Item>
            <Form.Item name="day_type" label="&nbsp;">
              <Select style={{ width: 160 }} options={[
                { value: 'calendar', label: t('deadlines.calendar') },
                { value: 'business', label: t('deadlines.business') },
                { value: 'legal', label: t('deadlines.legal') }
              ]} />
            </Form.Item>
          </Space>
          <Form.Item name="legal_basis" label={t('deadlines.legalBasis')}><Input placeholder="Art. … (loi n° …)" /></Form.Item>
          <Form.Item name="priority" label={t('cases.priority')}>
            <Select options={[{ value: 'high', label: t('common.high') }, { value: 'medium', label: t('common.medium') }, { value: 'low', label: t('common.low') }]} />
          </Form.Item>
          <Form.Item name="responsible_lawyer_id" label={t('cases.responsible')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* task modal */}
      <Modal title={t('tasks.newTask')} open={taskModal} onOk={addTask} onCancel={() => setTaskModal(false)} okText={t('common.save')}>
        <Form form={taskForm} layout="vertical" initialValues={{ priority: 'medium' }}>
          <Form.Item name="title" label={t('common.name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label={t('common.description')}><Input.TextArea rows={2} /></Form.Item>
          <Space>
            <Form.Item name="due_date" label={t('tasks.dueDate')}><DatePicker /></Form.Item>
            <Form.Item name="assigned_to" label={t('tasks.assignee')}>
              <Select allowClear showSearch optionFilterProp="label" style={{ width: 200 }} options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))} />
            </Form.Item>
            <Form.Item name="priority" label={t('cases.priority')}>
              <Select style={{ width: 120 }} options={[{ value: 'high', label: t('common.high') }, { value: 'medium', label: t('common.medium') }, { value: 'low', label: t('common.low') }]} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* timeline event modal */}
      <Modal title={t('cases.addEvent')} open={eventModal} onOk={addEvent} onCancel={() => setEventModal(false)} okText={t('common.save')}>
        <Form form={eventForm} layout="vertical" initialValues={{ event_type: 'note', event_date: dayjs() }}>
          <Form.Item name="event_date" label={t('common.date')} rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="event_type" label={t('cases.eventType')}>
            <Select options={['consultation', 'document', 'filing', 'note', 'status', 'event'].map((v) => ({ value: v, label: t(`event.${v}`) }))} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')} rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      {/* hearing outcome modal */}
      <Modal title={`${t('hearings.recordOutcome')} — ${outcomeModal?.date || ''}`} open={!!outcomeModal} onOk={saveOutcome} onCancel={() => setOutcomeModal(null)} okText={t('common.save')}>
        <Form form={outcomeForm} layout="vertical">
          <Form.Item name="outcome" label={t('hearings.outcome')}><Input.TextArea rows={3} placeholder="…" /></Form.Item>
          <Form.Item name="adjournment_reason" label={t('hearings.adjournment')}><Input /></Form.Item>
          <Form.Item name="next_date" label={t('hearings.nextDate')}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="status" label={t('common.status')} initialValue="held">
            <Select options={[
              { value: 'held', label: t('hearings.statusHeld') },
              { value: 'scheduled', label: t('hearings.statusScheduled') },
              { value: 'cancelled', label: t('hearings.statusCancelled') }
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
