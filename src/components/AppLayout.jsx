/** Application shell: sidebar, topbar, global search, notifications, language switcher, disclaimer. */
import React, { useEffect, useState, useCallback } from 'react';
import { Layout, Menu, Input, Badge, Dropdown, Avatar, Button, Tooltip, Tag, Empty, Spin, theme as antdTheme } from 'antd';
import {
  DashboardOutlined, FolderOpenOutlined, TeamOutlined, SafetyCertificateOutlined,
  SoundOutlined, CalendarOutlined, FieldTimeOutlined, CheckSquareOutlined,
  FileTextOutlined, FileSyncOutlined, BookOutlined, BankOutlined, AccountBookOutlined,
  ContactsOutlined, UsergroupAddOutlined, InboxOutlined, BarChartOutlined,
  SettingOutlined, SearchOutlined, BellOutlined, LogoutOutlined, GlobalOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, WarningOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

export default function AppLayout() {
  const { t, lang, setLang, pick } = useI18n();
  const { user, logout, can } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState(null);
  const [settings, setSettings] = useState({});
  const { token: antdToken } = antdTheme.useToken();

  useEffect(() => {
    api('/admin/settings').then(setSettings).catch(() => {});
    const id = setInterval(() => {
      api('/admin/notifications').then(setNotifs).catch(() => {});
    }, 60000);
    api('/admin/notifications').then(setNotifs).catch(() => {});
    return () => clearInterval(id);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const data = await api(`/insights/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.results);
    } catch (e) { setSearchResults([]); }
    setSearching(false);
  }, []);

  const goResult = (r) => {
    setSearchResults(null);
    setSearchQ('');
    nav(r.route);
  };

  const menuItems = [
    { key: 'g1', type: 'group', label: t('nav.groupPractice'), children: [
      can('cases.view') && { key: '/', icon: <DashboardOutlined />, label: t('nav.dashboard') },
      can('cases.view') && { key: '/cases', icon: <FolderOpenOutlined />, label: t('nav.cases') },
      can('clients.view') && { key: '/clients', icon: <TeamOutlined />, label: t('nav.clients') },
      can('conflict.check') && { key: '/conflict', icon: <SafetyCertificateOutlined />, label: t('nav.conflict') },
      can('hearings.view') && { key: '/hearings', icon: <SoundOutlined />, label: t('nav.hearings') },
      can('calendar.view') && { key: '/calendar', icon: <CalendarOutlined />, label: t('nav.calendar') },
      can('deadlines.view') && { key: '/deadlines', icon: <FieldTimeOutlined />, label: t('nav.deadlines') },
      can('tasks.view') && { key: '/tasks', icon: <CheckSquareOutlined />, label: t('nav.tasks') }
    ].filter(Boolean) },
    { key: 'g2', type: 'group', label: t('nav.groupOrg'), children: [
      can('documents.view') && { key: '/documents', icon: <FileTextOutlined />, label: t('nav.documents') },
      can('documents.view') && { key: '/templates', icon: <FileSyncOutlined />, label: t('nav.templates') },
      can('finance.view') && { key: '/finance', icon: <AccountBookOutlined />, label: t('nav.finance') },
      can('contacts.view') && { key: '/contacts', icon: <ContactsOutlined />, label: t('nav.contacts') },
      can('staff.view') && { key: '/staff', icon: <UsergroupAddOutlined />, label: t('nav.staff') },
      can('cases.view') && { key: '/archives', icon: <InboxOutlined />, label: t('nav.archives') }
    ].filter(Boolean) },
    { key: 'g3', type: 'group', label: t('nav.groupKnowledge'), children: [
      can('legal.view') && { key: '/library', icon: <BookOutlined />, label: t('nav.library') },
      can('directory.view') && { key: '/directory', icon: <BankOutlined />, label: t('nav.directory') }
    ].filter(Boolean) },
    { key: 'g4', type: 'group', label: t('nav.groupAdmin'), children: [
      can('reports.view') && { key: '/reports', icon: <BarChartOutlined />, label: t('nav.reports') },
      { key: '/search', icon: <SearchOutlined />, label: t('search.title') },
      can('settings.manage') && { key: '/settings', icon: <SettingOutlined />, label: t('nav.settings') }
    ].filter(Boolean) }
  ];

  const selectedKey = '/' + (loc.pathname.split('/')[1] || '');
  const firmName = settings['firm.name.' + lang] || settings['firm.name.fr'] || t('app.name');
  const disclaimer = settings['app.disclaimer_enabled'] === 'false' ? null : settings[`app.disclaimer_${lang}`];
  const dynamicCount = notifs ? notifs.dynamic.length + notifs.unread : 0;

  const notifContent = notifs ? (
    <div style={{ width: 380, maxHeight: 480, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #eee' }}>
        <b>{t('notif.title')}</b>
        <Button size="small" type="text" onClick={async () => { await api('/admin/notifications/read-all', { method: 'PUT' }); api('/admin/notifications').then(setNotifs); }}>
          {t('notif.markAllRead')}
        </Button>
      </div>
      {notifs.dynamic.length === 0 && notifs.stored.filter((n) => !n.is_read).length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('notif.empty')} style={{ padding: 24 }} />
      )}
      {notifs.dynamic.map((n, i) => (
        <div key={`d${i}`} style={{ padding: '10px 12px', borderBottom: '1px solid #f2f2f2', cursor: 'default' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Tag color={n.priority ? 'red' : 'blue'} style={{ marginTop: 2 }}>{t(`notif.${n.kind}`)}</Tag>
            <div>
              <div style={{ fontWeight: 600 }}>{n.title_fr}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{n.sub_fr} {n.date && `· ${n.date}`}</div>
              {n.case_id && <a onClick={() => { setNotifOpen(false); nav(`/cases/${n.case_id}`); }}>{t('common.open')}</a>}
            </div>
          </div>
        </div>
      ))}
      {notifs.stored.filter((n) => !n.is_read).map((n) => (
        <div key={n.id} style={{ padding: '10px 12px', borderBottom: '1px solid #f2f2f2' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Tag color="purple" style={{ marginTop: 2 }}>{t(`notif.${n.kind}`) || n.kind}</Tag>
            <div>
              <div style={{ fontWeight: 600 }}>{lang === 'ar' ? n.title_ar : n.title_fr}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{lang === 'ar' ? n.body_ar : n.body_fr}</div>
              <a onClick={async () => {
                await api(`/admin/notifications/${n.id}/read`, { method: 'PUT' });
                api('/admin/notifications').then(setNotifs);
                if (n.ref_type === 'task') nav('/tasks');
              }}>{t('common.open')}</a>
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : <Spin />;

  return (
    <div className="app-shell" style={{ display: 'flex' }}>
      <aside className="sidebar" style={{ width: collapsed ? 72 : undefined, transition: 'width .2s' }}>
        <div className="sidebar-logo">
          <div className="scale">⚖️</div>
          {!collapsed && (
            <div>
              <div className="brand-title" style={{ fontSize: 14.5, color: '#fff' }}>ADVOCATE PRO</div>
              <div className="brand-sub" style={{ color: 'var(--gold-400)' }}>{lang === 'ar' ? 'الجزائر' : 'ALGÉRIE'}</div>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          inlineCollapsed={collapsed}
          onClick={({ key }) => nav(key)}
          style={{ background: 'transparent', border: 'none', flex: 1, padding: '6px' }}
        />
        <div style={{ padding: 10, fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center' }}>
          {collapsed ? 'v1.0' : 'ADVOCATE PRO ALGÉRIE — v1.0'}
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar no-print">
          <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} />
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder={t('common.searchGlobal')}
            style={{ maxWidth: 480 }}
            value={searchQ}
            onChange={(e) => { setSearchQ(e.target.value); doSearch(e.target.value); }}
          />
          {searchResults && (
            <div style={{
              position: 'absolute', top: 54, insetInlineStart: collapsed ? 100 : 180, zIndex: 1000,
              background: '#fff', border: '1px solid var(--line)', borderRadius: 10, width: 520, maxHeight: 460, overflowY: 'auto',
              boxShadow: '0 12px 32px rgba(15,42,71,.15)'
            }}>
              {searching && <div style={{ padding: 20, textAlign: 'center' }}><Spin /></div>}
              {!searching && searchResults.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('search.noResults')} style={{ padding: 18 }} />}
              {!searching && searchResults.map((r, i) => (
                <div key={i} onClick={() => goResult(r)} style={{ padding: '9px 14px', borderBottom: '1px solid #f4f6f9', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f9fc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <Tag color={typeColor(r.type)}>{t(`search.type.${r.type}`) || r.type}</Tag>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: '#8aa0b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ flex: 1 }} />
          <Tooltip title={lang === 'fr' ? 'العربية' : 'Français'}>
            <Button icon={<GlobalOutlined />} onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')} style={{ fontWeight: 700 }}>
              {lang === 'fr' ? 'ع' : 'FR'}
            </Button>
          </Tooltip>
          <Dropdown open={notifOpen} onOpenChange={setNotifOpen} trigger={['click']} placement="bottomRight" overlayStyle={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
            <Badge count={dynamicCount} size="small" offset={[-4, 4]} color="#c0392b">
              <Button icon={<BellOutlined />} />
            </Badge>
          </Dropdown>
          <Dropdown
            menu={{
              items: [
                { key: 'name', label: <b>{pick(user, 'full_name') || user?.username}</b>, disabled: true },
                { key: 'role', label: t(`staff.role.${user?.role}`), disabled: true },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: t('auth.logout'), onClick: logout }
              ]
            }}
            trigger={['click']}
          >
            <Avatar style={{ background: 'var(--navy-700)', cursor: 'pointer' }} icon={<TeamOutlined />} />
          </Dropdown>
        </header>

        <main className="content">
          {disclaimer && (
            <div className="disclaimer-banner no-print">
              <WarningOutlined style={{ color: '#a07d1d', marginTop: 2 }} />
              <span>{disclaimer}</span>
            </div>
          )}
          <Outlet context={{ settings }} />
        </main>
      </div>
    </div>
  );
}

function typeColor(type) {
  return {
    case: 'geekblue', client: 'green', document: 'orange', legal_text: 'purple',
    legal_article: 'magenta', jurisprudence: 'volcano', court: 'cyan', task: 'gold',
    contact: 'blue', deadline: 'red'
  }[type] || 'default';
}
