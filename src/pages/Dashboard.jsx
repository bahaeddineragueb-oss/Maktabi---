/** Morning dashboard: everything a lawyer must know at a glance. */
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, List, Tag, Typography, Button, Empty, Spin, Progress } from 'antd';
import {
  SoundOutlined, FieldTimeOutlined, CheckSquareOutlined, AccountBookOutlined,
  FolderOpenOutlined, TeamOutlined, CalendarOutlined, WarningOutlined, RightOutlined,
  PlusOutlined, InboxOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader, DZD } from '../components/common.jsx';

const STAT_COLORS = { blue: '#e7f1ff', red: '#fdecea', orange: '#fff4e5', green: '#edf7ed', purple: '#f3eefa', gold: '#faf3dd' };
const STAT_ICON = { blue: '#1b5e9e', red: '#c0392b', orange: '#a06b00', green: '#2e7d32', purple: '#6d3fa0', gold: '#8a6d1a' };

function Stat({ icon, label, value, color, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div className="icon-wrap" style={{ background: STAT_COLORS[color], color: STAT_ICON[color] }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy-800)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, lang, pick } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => { api('/insights/dashboard').then(setData).catch(() => {}); }, []);

  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  const name = pick(user, 'full_name') || user?.username;

  return (
    <div>
      <PageHeader
        title={`${t('dashboard.welcome')}, ${name}`}
        subtitle={dayjs().format(lang === 'ar' ? 'dddd D MMMM YYYY' : 'dddd D MMMM YYYY')}
        extra={[
          <Button key="nc" type="primary" icon={<PlusOutlined />} onClick={() => nav('/cases?new=1')}>{t('dashboard.newCase')}</Button>,
          <Button key="nh" icon={<SoundOutlined />} onClick={() => nav('/hearings?new=1')}>{t('dashboard.newHearing')}</Button>,
          <Button key="nt" icon={<CheckSquareOutlined />} onClick={() => nav('/tasks?new=1')}>{t('dashboard.newTask')}</Button>
        ]}
      />
      <Row gutter={[14, 14]}>
        <Col xs={12} md={6} xl={3}><Stat icon={<FolderOpenOutlined />} label={t('dashboard.activeCases')} value={data.counters.active_cases} color="blue" onClick={() => nav('/cases')} /></Col>
        <Col xs={12} md={6} xl={3}><Stat icon={<TeamOutlined />} label={t('dashboard.clients')} value={data.counters.clients} color="green" onClick={() => nav('/clients')} /></Col>
        <Col xs={12} md={6} xl={3}><Stat icon={<SoundOutlined />} label={t('dashboard.hearingsWeek')} value={data.counters.hearings_this_week} color="purple" onClick={() => nav('/hearings')} /></Col>
        <Col xs={12} md={6} xl={3}><Stat icon={<FieldTimeOutlined />} label={t('dashboard.activeDeadlines')} value={data.counters.active_deadlines} color="gold" onClick={() => nav('/deadlines')} /></Col>
        <Col xs={12} md={6} xl={3}><Stat icon={<CheckSquareOutlined />} label={t('dashboard.openTasks')} value={data.counters.open_tasks} color="orange" onClick={() => nav('/tasks')} /></Col>
        <Col xs={12} md={6} xl={3}><Stat icon={<AccountBookOutlined />} label={t('dashboard.receivables')} value={<span style={{ fontSize: 15 }}>{DZD(data.counters.receivables)}</span>} color="red" onClick={() => nav('/finance')} /></Col>
        <Col xs={12} md={6} xl={3}><Stat icon={<WarningOutlined />} label={t('dashboard.overdueTasks')} value={data.overdueTasks.length} color="red" onClick={() => nav('/tasks?overdue=1')} /></Col>
        <Col xs={12} md={6} xl={3}><Stat icon={<InboxOutlined />} label={t('dashboard.inactiveCases')} value={data.inactiveCases.length} color="orange" onClick={() => nav('/cases?inactive=1')} /></Col>
      </Row>

      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        <Col xs={24} lg={13}>
          <div className="panel">
            <div className="panel-title"><SoundOutlined /> {t('dashboard.hearingsToday')}</div>
            {data.hearingsToday.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dashboard.noHearings')} />}
            <List
              dataSource={data.hearingsToday}
              renderItem={(h) => (
                <List.Item style={{ cursor: 'pointer', padding: '10px 4px' }} onClick={() => nav(`/cases/${h.case_id}`)}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
                    <div style={{ textAlign: 'center', minWidth: 64 }}>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy-700)' }}>{h.time || '--:--'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('common.time')}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--navy-800)' }}>{pick(h, 'title') || h.reference}</div>
                      <div style={{ fontSize: 12.5, color: '#64748b' }}>
                        {pick(h, 'court_name')} {h.chamber_name_fr && `· ${h.chamber_name_fr}`} {h.room && `· ${t('hearings.room')} ${h.room}`}
                      </div>
                      <div style={{ fontSize: 12, color: '#8aa0b8' }}>{t('common.lawyer')}: {pick(h, 'lawyer_name') || '—'}</div>
                    </div>
                    <Tag color="geekblue">{t(`hearings.type.${h.hearing_type}`) || h.hearing_type}</Tag>
                  </div>
                </List.Item>
              )}
            />
            {data.hearingsTomorrow.length > 0 && (
              <>
                <div className="panel-title" style={{ marginTop: 14 }}><ClockCircleOutlined /> {t('dashboard.hearingsTomorrow')}</div>
                {data.hearingsTomorrow.map((h) => (
                  <div key={h.id} style={{ display: 'flex', gap: 10, padding: '6px 4px', borderBottom: '1px dashed #eef1f5', cursor: 'pointer' }} onClick={() => nav(`/cases/${h.case_id}`)}>
                    <span className="mono" style={{ color: 'var(--navy-700)', fontWeight: 700 }}>{h.time || ''}</span>
                    <span style={{ flex: 1 }}>{pick(h, 'title') || h.reference}</span>
                    <span style={{ color: '#8aa0b8', fontSize: 12.5 }}>{pick(h, 'court_name')}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </Col>

        <Col xs={24} lg={11}>
          <div className="panel">
            <div className="panel-title"><FieldTimeOutlined /> {t('dashboard.deadlinesSoon')}</div>
            {data.deadlinesSoon.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            <List
              size="small"
              dataSource={data.deadlinesSoon}
              renderItem={(d) => {
                const days = dayjs(d.end_date).diff(dayjs(), 'day');
                return (
                  <List.Item style={{ cursor: 'pointer', padding: '8px 4px' }} onClick={() => nav(`/cases/${d.case_id}`)}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <b style={{ color: 'var(--navy-800)' }}>{pick(d, 'title')}</b>
                        <Tag color={days <= 2 ? 'red' : days <= 7 ? 'orange' : 'blue'}>{d.end_date}{days >= 0 ? ` · J-${days}` : ''}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#8aa0b8' }}>{d.reference} {d.is_computed ? '· ⚠️ ' + t('deadlines.autoWarning') : ''}</div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>

          <div className="panel">
            <div className="panel-title"><AccountBookOutlined /> {t('dashboard.unpaidInvoices')}</div>
            {data.unpaidInvoices.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            {data.unpaidInvoices.map((i) => (
              <div key={i.id} style={{ display: 'flex', gap: 10, padding: '7px 4px', borderBottom: '1px dashed #eef1f5', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{i.client_name || i.legal_name || '—'}</b>
                  <div style={{ fontSize: 12, color: '#8aa0b8' }}>{i.number} · {t('finance.dueDate')}: {i.due_date || '—'}</div>
                </div>
                <span style={{ fontWeight: 700, color: i.due_date && i.due_date < data.today ? '#c0392b' : 'var(--navy-700)' }}>{DZD(i.balance)}</span>
              </div>
            ))}
          </div>
        </Col>

        <Col xs={24} lg={13}>
          <div className="panel">
            <div className="panel-title"><CheckSquareOutlined /> {t('dashboard.overdueTasks')}</div>
            {data.overdueTasks.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            {data.overdueTasks.map((task) => (
              <div key={task.id} style={{ display: 'flex', gap: 10, padding: '7px 4px', borderBottom: '1px dashed #eef1f5', alignItems: 'center' }}>
                <Tag color="red">{task.due_date}</Tag>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{task.title}</div>
                  <div style={{ fontSize: 12, color: '#8aa0b8' }}>{task.assignee_name_fr} {task.reference && `· ${task.reference}`}</div>
                </div>
                <Button size="small" onClick={() => nav(task.case_id ? `/cases/${task.case_id}` : '/tasks')} icon={<RightOutlined />} />
              </div>
            ))}
          </div>
        </Col>

        <Col xs={24} lg={11}>
          <div className="panel">
            <div className="panel-title"><CalendarOutlined /> {t('dashboard.appointments')}</div>
            {data.upcomingAppointments.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            {data.upcomingAppointments.map((e) => (
              <div key={e.id} style={{ display: 'flex', gap: 10, padding: '7px 4px', borderBottom: '1px dashed #eef1f5' }}>
                <div style={{ minWidth: 74 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy-700)' }}>{e.start_at?.slice(5, 10)}</div>
                  <div className="mono" style={{ fontSize: 12 }}>{e.start_at?.slice(11, 16)}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: '#8aa0b8' }}>{e.location}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-title"><InboxOutlined /> {t('dashboard.inactiveCases')}</div>
            {data.inactiveCases.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            {data.inactiveCases.map((c) => (
              <div key={c.id} style={{ display: 'flex', gap: 10, padding: '7px 4px', borderBottom: '1px dashed #eef1f5', cursor: 'pointer', alignItems: 'center' }} onClick={() => nav(`/cases/${c.id}`)}>
                <div style={{ flex: 1 }}>
                  <b>{c.title_fr}</b>
                  <div style={{ fontSize: 12, color: '#8aa0b8' }}>{c.reference} · {t('cases.lastAction')}: {c.last_action_at?.slice(0, 10) || '—'}</div>
                </div>
                <span className="verify-badge" style={{ borderColor: c.status_color, color: c.status_color }}>{c.status_name_fr}</span>
              </div>
            ))}
          </div>
        </Col>

        <Col span={24}>
          <div className="panel">
            <div className="panel-title"><FolderOpenOutlined /> {t('dashboard.casesByStatus')}</div>
            <Row gutter={[10, 10]}>
              {data.casesByStatus.filter((s) => s.count > 0).map((s) => (
                <Col xs={12} md={8} lg={6} xl={4} key={s.code}>
                  <div style={{ border: `1px solid ${s.color}44`, borderRadius: 10, padding: '8px 12px', background: `${s.color}0d` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, color: s.color }}>{lang === 'ar' ? s.name_ar : s.name_fr}</span>
                      <b style={{ color: s.color }}>{s.count}</b>
                    </div>
                    <Progress percent={Math.round((s.count / Math.max(...data.casesByStatus.map((x) => x.count))) * 100)} showInfo={false} strokeColor={s.color} size="small" />
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        </Col>
      </Row>
    </div>
  );
}
