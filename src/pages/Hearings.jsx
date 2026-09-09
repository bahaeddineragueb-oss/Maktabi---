/** Hearings module: calendar views (day/week/month/agenda) + court & lawyer views. */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Badge, Card, Select, List, Tag, Modal, Form, Input, DatePicker, Button,
  App, Space, Typography, Tooltip, Drawer, Descriptions
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader, hearingTypeOptions } from '../components/common.jsx';

const TYPE_COLORS = { hearing: ['geekblue', 'audience'], deadline: ['red', 'échéance'] };

export default function Hearings() {
  const { t, lang, pick } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [view, setView] = useState('day');
  const [selectedDay, setSelectedDay] = useState(dayjs());
  const [hearings, setHearings] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [meta, setMeta] = useState({ courts: [], users: [], cases: [] });
  const [filters, setFilters] = useState({ court_id: '', lawyer_id: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [form] = Form.useForm();
  const [outcomeForm] = Form.useForm();

  const loadCalendar = async (from, to) => {
    const params = new URLSearchParams({ from, to });
    if (filters.lawyer_id) params.set('lawyer_id', filters.lawyer_id);
    const data = await api(`/schedule/calendar?${params}`);
    setCalendarData(data.items);
  };

  useEffect(() => {
    Promise.all([api('/directory/courts'), api('/admin/users'), api('/cases?limit=200')])
      .then(([courts, users, cases]) => setMeta({ courts, users: users.filter((u) => u.is_active), cases: cases.rows }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCalendar(dayjs().startOf('year').format('YYYY-MM-DD'), dayjs().endOf('year').format('YYYY-MM-DD'));
  }, [filters]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.court_id) params.set('court_id', filters.court_id);
    if (filters.lawyer_id) params.set('lawyer_id', filters.lawyer_id);
    api(`/schedule/hearings?${params}`).then(setHearings).catch(() => {});
  }, [filters]);

  const itemsForDay = (d) => calendarData.filter((i) => i.date === d.format('YYYY-MM-DD'));

  const cellRender = (current) => {
    const items = itemsForDay(current);
    if (!items.length) return null;
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.slice(0, 3).map((i, idx) => (
          <li key={idx}>
            <span className={`chip chip-${i.type}`}>{i.time ? `${i.time} ` : ''}{i.title?.slice(0, 22)}</span>
          </li>
        ))}
        {items.length > 3 && <li style={{ fontSize: 11, color: '#94a3b8' }}>+{items.length - 3}</li>}
      </ul>
    );
  };

  const addHearing = async () => {
    const v = await form.validateFields();
    await api('/schedule/hearings', { method: 'POST', body: { ...v, date: v.date.format('YYYY-MM-DD') } });
    message.success(t('hearings.newHearing'));
    setModalOpen(false);
    form.resetFields();
    loadCalendar(dayjs().startOf('year').format('YYYY-MM-DD'), dayjs().endOf('year').format('YYYY-MM-DD'));
    api('/schedule/hearings').then(setHearings);
  };

  const saveOutcome = async () => {
    const v = await outcomeForm.validateFields();
    await api(`/schedule/hearings/${outcome.id}/outcome`, {
      method: 'PUT',
      body: { ...v, next_date: v.next_date ? v.next_date.format('YYYY-MM-DD') : null }
    });
    message.success(t('hearings.recordOutcome'));
    setOutcome(null);
    api('/schedule/hearings').then(setHearings);
  };

  const dayList = useMemo(() => {
    const from = view === 'week' ? selectedDay.startOf('week') : selectedDay.startOf('day');
    const days = view === 'week' ? [...Array(7)].map((_, i) => from.add(i, 'day')) : [selectedDay];
    return days;
  }, [view, selectedDay]);

  const agenda = useMemo(() => {
    const map = {};
    calendarData.forEach((i) => {
      if (!map[i.date]) map[i.date] = [];
      map[i.date].push(i);
    });
    return Object.entries(map).filter(([d]) => d >= dayjs().format('YYYY-MM-DD')).sort().slice(0, 30);
  }, [calendarData]);

  return (
    <div>
      <PageHeader
        title={t('hearings.title')}
        subtitle={t('hearings.subtitle')}
        extra={can('hearings.edit') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>{t('hearings.newHearing')}</Button>}
      />
      <Card size="small" style={{ marginBottom: 14 }}>
        <Space wrap>
          {[
            ['day', t('hearings.day')], ['week', t('hearings.week')], ['month', t('hearings.month')], ['agenda', t('hearings.agenda')],
            ['court', t('hearings.courtView')], ['lawyer', t('hearings.lawyerView')]
          ].map(([v, label]) => (
            <Button key={v} type={view === v ? 'primary' : 'default'} onClick={() => setView(v)} size="small">{label}</Button>
          ))}
          <Select allowClear placeholder={t('common.lawyer')} style={{ width: 170 }} showSearch optionFilterProp="label"
            options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))}
            onChange={(v) => setFilters((f) => ({ ...f, lawyer_id: v || '' }))} />
          <Select allowClear placeholder={t('cases.court')} style={{ width: 200 }} showSearch optionFilterProp="label"
            options={meta.courts.map((c) => ({ value: c.id, label: pick(c, 'name') }))}
            onChange={(v) => setFilters((f) => ({ ...f, court_id: v || '' }))} />
        </Space>
      </Card>

      {(view === 'day' || view === 'week') && (
        <Row7 days={dayList} items={itemsForDay} nav={nav} t={t} pick={pick} onOutcome={can('hearings.edit') ? setOutcome : null} />
      )}

      {view === 'month' && (
        <Card>
          <Calendar
            fullscreen
            cellRender={(current, info) => (info.type === 'date' ? cellRender(current) : null)}
            onSelect={(d) => { setSelectedDay(d); setView('day'); }}
          />
        </Card>
      )}

      {view === 'agenda' && (
        <Card>
          {agenda.map(([date, items]) => (
            <div key={date} style={{ marginBottom: 14 }}>
              <Typography.Title level={5} style={{ color: 'var(--navy-700)' }}>
                {dayjs(date).locale(lang === 'ar' ? 'ar' : 'fr').format('dddd D MMMM YYYY')}
              </Typography.Title>
              {items.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px dashed #eef1f5', alignItems: 'center' }}>
                  <span className={`chip chip-${i.type}`}>{t(`calendar.${i.type}`)}</span>
                  <span style={{ flex: 1 }}>{i.title}</span>
                  <span style={{ color: '#8aa0b8', fontSize: 12.5 }}>{i.sub}</span>
                  {i.time && <span className="mono">{i.time}</span>}
                </div>
              ))}
            </div>
          ))}
        </Card>
      )}

      {view === 'court' && <GroupBy field="court_name_fr" label={t('cases.court')} hearings={hearings} t={t} pick={pick} />}
      {view === 'lawyer' && <GroupBy field="lawyer_name_fr" label={t('common.lawyer')} hearings={hearings} t={t} pick={pick} />}

      <Modal title={t('hearings.newHearing')} open={modalOpen} onOk={addHearing} onCancel={() => setModalOpen(false)} okText={t('common.save')} width={640}>
        <Form form={form} layout="vertical" initialValues={{ hearing_type: 'civil', time: '09:00', date: selectedDay }}>
          <Form.Item name="case_id" label={t('common.case')} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={meta.cases.map((c) => ({ value: c.id, label: `${c.reference} — ${pick(c, 'title')}` }))} />
          </Form.Item>
          <Space>
            <Form.Item name="date" label={t('common.date')} rules={[{ required: true }]}><DatePicker /></Form.Item>
            <Form.Item name="time" label={t('common.time')}><Input type="time" /></Form.Item>
            <Form.Item name="hearing_type" label={t('hearings.hearingType')}>
              <Select style={{ width: 200 }} options={hearingTypeOptions(t)} />
            </Form.Item>
          </Space>
          <Space>
            <Form.Item name="court_id" label={t('cases.court')}>
              <Select allowClear showSearch optionFilterProp="label" style={{ width: 240 }} options={meta.courts.map((c) => ({ value: c.id, label: pick(c, 'name') }))} />
            </Form.Item>
            <Form.Item name="lawyer_id" label={t('common.lawyer')}>
              <Select allowClear showSearch optionFilterProp="label" style={{ width: 200 }} options={meta.users.map((u) => ({ value: u.id, label: pick(u, 'full_name') }))} />
            </Form.Item>
          </Space>
          <Space>
            <Form.Item name="room" label={t('hearings.room')}><Input /></Form.Item>
            <Form.Item name="judge" label={t('cases.judge')}><Input /></Form.Item>
          </Space>
          <Form.Item name="purpose" label={t('hearings.purpose')}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="required_documents" label={t('hearings.requiredDocuments')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`${t('hearings.recordOutcome')} — ${outcome?.date || ''}`} open={!!outcome} onOk={saveOutcome} onCancel={() => setOutcome(null)} okText={t('common.save')}>
        <Form form={outcomeForm} layout="vertical">
          <Form.Item name="outcome" label={t('hearings.outcome')}><Input.TextArea rows={3} /></Form.Item>
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

function Row7({ days, items, nav, t, pick, onOutcome }) {
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
      {days.map((d) => {
        const items2 = items(d);
        const isToday = d.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');
        return (
          <Card
            key={d.format()}
            size="small"
            title={
              <span style={{ color: isToday ? '#c0392b' : 'var(--navy-700)' }}>
                {d.locale(d.locale() === 'ar' ? 'ar' : 'fr').format('ddd D MMM')} {isToday && `· ${t('common.today')}`}
              </span>
            }
            style={{ minWidth: 260, flex: 1, border: isToday ? '1px solid #c0392b44' : undefined }}
          >
            {items2.length === 0 && <div style={{ color: '#b3bfd0', textAlign: 'center', padding: 20 }}>—</div>}
            {items2.map((i, idx) => (
              <div
                key={idx}
                className={`chip chip-${i.type}`}
                style={{ display: 'flex', width: '100%', marginBottom: 6, cursor: i.case_id ? 'pointer' : 'default', padding: '6px 8px' }}
                onClick={() => i.case_id && i.type === 'hearing' ? nav(`/cases/${i.case_id}`) : null}
              >
                {i.time && <b style={{ minWidth: 42 }}>{i.time}</b>}
                <span style={{ flex: 1, textAlign: 'start', whiteSpace: 'normal' }}>{i.title}</span>
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}

function GroupBy({ field, label, hearings, t, pick }) {
  const groups = {};
  for (const h of hearings) {
    const key = pick(h, field.replace('_fr', '')) || '—';
    (groups[key] = groups[key] || []).push(h);
  }
  return (
    <div>
      {Object.entries(groups).sort().map(([k, list]) => (
        <Card key={k} size="small" title={`${label}: ${k} (${list.length})`} style={{ marginBottom: 12 }}>
          {list.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).map((h) => (
            <div key={h.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px dashed #eef1f5', alignItems: 'center' }}>
              <b style={{ minWidth: 118, color: 'var(--navy-700)' }}>{h.date} {h.time}</b>
              <Tag>{t(`hearings.type.${h.hearing_type}`)}</Tag>
              <span style={{ flex: 1 }}>{h.case_reference ? `${h.case_reference} — ${pick(h, 'case_title')}` : '—'}</span>
              <span style={{ color: '#8aa0b8', fontSize: 12 }}>{h.room ? `${t('hearings.room')} ${h.room}` : ''}</span>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
