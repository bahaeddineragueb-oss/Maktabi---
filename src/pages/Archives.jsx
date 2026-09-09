/** Archives: archived cases & clients with restore. */
import React, { useEffect, useState } from 'react';
import { Tabs, Table, Button, Tag, App, Popconfirm } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader } from '../components/common.jsx';

export default function Archives() {
  const { t, pick } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);

  const load = () => {
    api('/cases?archived=1&limit=200').then((d) => setCases(d.rows)).catch(() => {});
    api('/clients?archived=1&limit=200').then((d) => setClients(d.rows)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader title={t('archives.title')} subtitle={t('archives.subtitle')} />
      <Tabs items={[
        {
          key: 'cases', label: `${t('archives.cases')} (${cases.length})`,
          children: (
            <Table rowKey="id" dataSource={cases} size="middle"
              columns={[
                { title: t('cases.reference'), dataIndex: 'reference', width: 110 },
                { title: t('cases.titleFr'), dataIndex: 'title_fr', render: (v, r) => (
                  <a onClick={() => nav(`/cases/${r.id}`)} style={{ fontWeight: 600 }}>{pick(r, 'title')}</a>
                ) },
                { title: t('common.client'), dataIndex: 'client_name_fr', render: (v, r) => r.client_legal_name || v || '—' },
                { title: t('common.status'), dataIndex: 'status_name_fr', width: 130, render: (v, r) => <Tag color={r.status_color}>{pick(r, 'status_name')}</Tag> },
                { title: t('cases.openingDate'), dataIndex: 'opening_date', width: 110 },
                { title: t('cases.closingDate'), dataIndex: 'closing_date', width: 110, render: (v) => v || '—' },
                {
                  title: t('common.actions'), width: 110,
                  render: (r) => can('cases.edit') && (
                    <Popconfirm title={t('common.confirm')} onConfirm={async () => { await api(`/cases/${r.id}/restore`, { method: 'PUT' }); message.success(t('common.restore')); load(); }}>
                      <Button size="small" type="primary" ghost>{t('common.restore')}</Button>
                    </Popconfirm>
                  )
                }
              ]} />
          )
        },
        {
          key: 'clients', label: `${t('archives.clients')} (${clients.length})`,
          children: (
            <Table rowKey="id" dataSource={clients} size="middle"
              columns={[
                { title: t('common.name'), dataIndex: 'full_name_fr', render: (v, r) => r.legal_name || r.commercial_name || pick(r, 'full_name') },
                { title: t('common.type'), dataIndex: 'client_type', width: 140 },
                { title: t('common.phone'), dataIndex: 'phone', width: 140, render: (v) => v || '—' },
                { title: t('nav.cases'), dataIndex: 'cases_count', width: 90, align: 'center' },
                {
                  title: t('common.actions'), width: 110,
                  render: (r) => can('clients.edit') && (
                    <Popconfirm title={t('common.confirm')} onConfirm={async () => { await api(`/clients/${r.id}/restore`, { method: 'PUT' }); message.success(t('common.restore')); load(); }}>
                      <Button size="small" type="primary" ghost>{t('common.restore')}</Button>
                    </Popconfirm>
                  )
                }
              ]} />
          )
        }
      ]} />
    </div>
  );
}
