/** Unified calendar: hearings, deadlines, appointments, tasks, holidays + ICS export. */
import React, { useEffect, useState } from 'react';
import { Calendar, Card, Button, Modal, Form, Input, Select, DatePicker, TimePicker, App, Space, Typography, Tag } from 'antd';
import { PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api, getToken } from '../api.js';
import { PageHeader } from '../components/common.jsx';

export default function CalendarPage() {
  const { t, lang, pick } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ cases: [], users: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = (d) => {
    const from = (d || dayjs()).startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
    const to = (d || dayjs()).endOf('month').add(7, 'day').format('YYYY-MM-DD');
    api(`/schedule/calendar?from=${from}&to=${to}`).then((data) => setItems(data.items)).catch(() => {});
  };

  useEffect(() => {
    load(dayjs());
    Promise.all([api('/cases?limit=200'), api('/admin/users')]).then(([cases, users]) =>
      setMeta({ cases: cases.rows, users: users.filter((u) => u.is_active) })).catch(() => {});
  }, []);

  const addEvent = async () => {
    const v = await form.validateFields();
    await api('/schedule/events', {
      method: 'POST',
      body: {
        ...v,
        start_at: `${v.date.format('YYYY-MM-DD')}T${v.start.format('HH:mm')}`,
        end_at: v.end ? `${v.date.format('YYYY-MM-DD')}T${v.end.format('HH:mm')}` : null
      }
    });
    message.success(t('common.save'));
    setModalOpen(false);
    form.resetFields();
    load();
  };

  const cellRender = (current) => {
    const dayItems = items.filter((i) => i.date === current.format('YYYY-MM-DD'));
    if (!dayItems.length) return null;
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayItems.slice(0, 4).map((i, idx) => (
          <li key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span className={`chip chip-${i.type}`} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i.time ? `${i.time} ` : ''}{i.title?.slice(0, 18)}
            </span>
          </li>
        ))}
        {dayItems.length > 4 && <li style={{ fontSize: 11, color: '#94a3b8' }}>+{dayItems.length - 4}</li>}
      </ul>
    );
  };

  return (
    <div>
      <PageHeader
        title={t('calendar.title')}
        subtitle={t('calendar.subtitle')}
        extra={
          <>
            <Button icon={<DownloadOutlined />} href={`/api/schedule/calendar.ics?token=${getToken()}`}>
              {t('calendar.ics')}
            </Button>
            {can('calendar.edit') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>{t('calendar.newAppointment')}</Button>}
          </>
        }
      />
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <span style={{ fontWeight: 600 }}>{t('calendar.legend')}:</span>
          {['hearing', 'deadline', 'appointment', 'meeting', 'task', 'holiday'].map((c) => (
            <span key={c} className={`chip chip-${c}`}>{t(`calendar.${c}`)}</span>
          ))}
        </Space>
      </Card>
      <Card>
        <Calendar cellRender={(current, info) => (info.type === 'date' ? cellRender(current) : null)} onChange={load} />
      </Card>

      <Modal title={t('calendar.newAppointment')} open={modalOpen} onOk={addEvent} onCancel={() => setModalOpen(false)} okText={t('common.save')}>
        <Form form={form} layout="vertical" initialValues={{ event_type: 'appointment', start: dayjs('09:00', 'HH:mm'), date: dayjs() }}>
          <Form.Item name="title" label={t('calendar.appointmentTitle')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="event_type" label={t('common.type')}>
            <Select options={['appointment', 'client_meeting', 'internal', 'other'].map((v) => ({ value: v, label: t(`calendar.type.${v}`) }))} />
          </Form.Item>
          <Space>
            <Form.Item name="date" label={t('common.date')}><DatePicker /></Form.Item>
            <Form.Item name="start" label={t('calendar.start')}><TimePicker format="HH:mm" /></Form.Item>
            <Form.Item name="end" label={t('calendar.end')}><TimePicker format="HH:mm" /></Form.Item>
          </Space>
          <Form.Item name="location" label={t('calendar.location')}><Input /></Form.Item>
          <Form.Item name="case_id" label={t('common.case')}>
            <Select allowClear showSearch optionFilterProp="label" options={meta.cases.map((c) => ({ value: c.id, label: `${c.reference} — ${pick(c, 'title')}` }))} />
          </Form.Item>
          <Form.Item name="participants" label={t('calendar.participants')}>
            <Select mode="multiple" allowClear optionFilterProp="label" options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))} />
          </Form.Item>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
