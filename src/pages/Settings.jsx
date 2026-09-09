/** Settings: general, calendar/holidays, taxonomy, statuses, audit, backup, modules. */
import React, { useEffect, useState } from 'react';
import {
  Tabs, Card, Form, Input, Select, Switch, Button, App, Table, Modal, DatePicker,
  Tag, Space, Popconfirm, Typography, Alert, List
} from 'antd';
import { SaveOutlined, DownloadOutlined, PlusOutlined, AuditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api, download } from '../api.js';
import { PageHeader, VerifyBadge } from '../components/common.jsx';

export default function Settings() {
  const { t, lang, setLang, pick } = useI18n();
  const { can } = useAuth();

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <Tabs items={[
        { key: 'general', label: t('settings.general'), children: <GeneralTab t={t} lang={lang} setLang={setLang} can={can} /> },
        { key: 'calendar', label: t('settings.calendar'), children: <CalendarTab t={t} pick={pick} can={can} /> },
        { key: 'taxonomy', label: t('settings.taxonomy'), children: <TaxonomyTab t={t} pick={pick} can={can} /> },
        { key: 'audit', label: <span><AuditOutlined /> {t('settings.audit')}</span>, children: <AuditTab t={t} /> },
        { key: 'backup', label: t('settings.backup'), children: <BackupTab t={t} can={can} /> }
      ]} />
    </div>
  );
}

function GeneralTab({ t, lang, setLang, can }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [settings, setSettings] = useState(null);

  useEffect(() => { api('/admin/settings').then(setSettings).catch(() => {}); }, []);
  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        firm_name_fr: settings['firm.name.fr'],
        firm_name_ar: settings['firm.name.ar'],
        firm_address: settings['firm.address'],
        firm_phone: settings['firm.phone'],
        firm_email: settings['firm.email'],
        default_language: settings['app.default_language'],
        disclaimer_enabled: settings['app.disclaimer_enabled'] !== 'false',
        disclaimer_fr: settings['app.disclaimer_fr'],
        disclaimer_ar: settings['app.disclaimer_ar'],
        client_portal: settings['modules.client_portal'] === 'true',
        ai_assistant: settings['modules.ai_assistant'] === 'true'
      });
    }
  }, [settings]);

  const save = async () => {
    const v = await form.validateFields();
    await api('/admin/settings', {
      method: 'PUT',
      body: {
        settings: {
          'firm.name.fr': v.firm_name_fr, 'firm.name.ar': v.firm_name_ar,
          'firm.address': v.firm_address, 'firm.phone': v.firm_phone, 'firm.email': v.firm_email,
          'app.default_language': v.default_language,
          'app.disclaimer_enabled': v.disclaimer_enabled ? 'true' : 'false',
          'app.disclaimer_fr': v.disclaimer_fr, 'app.disclaimer_ar': v.disclaimer_ar,
          'modules.client_portal': v.client_portal ? 'true' : 'false',
          'modules.ai_assistant': v.ai_assistant ? 'true' : 'false'
        }
      }
    });
    message.success(t('settings.saved'));
  };

  if (!settings) return null;
  return (
    <Card>
      <Form form={form} layout="vertical" style={{ maxWidth: 760 }}>
        <Space style={{ display: 'flex' }}>
          <Form.Item name="firm_name_fr" label={t('settings.firmName')} style={{ flex: 1 }}><Input /></Form.Item>
          <Form.Item name="firm_name_ar" label={t('settings.firmNameAr')} style={{ flex: 1 }}><Input dir="rtl" /></Form.Item>
        </Space>
        <Space wrap>
          <Form.Item name="firm_address" label={t('common.address')}><Input /></Form.Item>
          <Form.Item name="firm_phone" label={t('common.phone')}><Input /></Form.Item>
          <Form.Item name="firm_email" label={t('common.email')}><Input /></Form.Item>
        </Space>
        <Form.Item name="default_language" label={t('settings.defaultLanguage')}>
          <Select style={{ width: 200 }} options={[{ value: 'fr', label: 'Français' }, { value: 'ar', label: 'العربية' }]} />
        </Form.Item>
        <Typography.Title level={5}>{t('settings.disclaimer')}</Typography.Title>
        <Form.Item name="disclaimer_enabled" valuePropName="checked" label={t('settings.disclaimerEnabled')}><Switch /></Form.Item>
        <Form.Item name="disclaimer_fr" label={t('settings.disclaimerText') + ' (FR)'}><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="disclaimer_ar" label={t('settings.disclaimerText') + ' (AR)'}><Input.TextArea rows={3} dir="rtl" /></Form.Item>
        <Typography.Title level={5}>{t('settings.modules')}</Typography.Title>
        <Form.Item name="client_portal" valuePropName="checked" label={t('settings.moduleClientPortal')}><Switch /></Form.Item>
        <Form.Item name="ai_assistant" valuePropName="checked" label={t('settings.moduleAI')} extra={t('settings.moduleAIHint')}><Switch /></Form.Item>
        {can('settings.manage') && <Button type="primary" icon={<SaveOutlined />} onClick={save}>{t('common.save')}</Button>}
      </Form>
    </Card>
  );
}

function CalendarTab({ t, pick, can }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => api('/schedule/holidays').then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const v = await form.validateFields();
    await api('/schedule/holidays', { method: 'POST', body: { ...v, date: v.date.format('YYYY-MM-DD') } });
    message.success(t('common.save'));
    setModalOpen(false);
    form.resetFields();
    load();
  };

  return (
    <Card>
      {can('settings.manage') && <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 14 }} onClick={() => setModalOpen(true)}>{t('settings.newHoliday')}</Button>}
      <Table rowKey="id" dataSource={rows} size="small" pagination={false}
        columns={[
          { title: t('common.date'), dataIndex: 'date', width: 110 },
          { title: t('common.name') + ' (FR)', dataIndex: 'name_fr' },
          { title: t('common.name') + ' (AR)', dataIndex: 'name_ar', render: (v) => <span dir="rtl">{v}</span> },
          { title: t('settings.holidayKind'), dataIndex: 'kind', width: 130, render: (v) => <Tag>{t(`settings.holidayKind.${v}`)}</Tag> },
          { title: t('settings.recurringAnnual'), dataIndex: 'is_recurring_annual', width: 110, render: (v) => (v ? <Tag color="blue">{t('common.yes')}</Tag> : '—') },
          { title: t('library.verification'), dataIndex: 'verification_status', width: 110, render: (v) => <VerifyBadge status={v} /> },
          { title: t('common.notes'), dataIndex: 'notes', ellipsis: true },
          can('settings.manage') && {
            title: '', width: 60,
            render: (r) => (
              <Popconfirm title={t('common.confirmDelete')} onConfirm={async () => { await api(`/schedule/holidays/${r.id}`, { method: 'DELETE' }); load(); }}>
                <Button size="small" danger>✕</Button>
              </Popconfirm>
            )
          }
        ].filter(Boolean)} />
      <Modal title={t('settings.newHoliday')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')}>
        <Form form={form} layout="vertical" initialValues={{ kind: 'public', verification_status: 'unverified' }}>
          <Space>
            <Form.Item name="name_fr" label={t('common.name') + ' (FR)'} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="name_ar" label={t('common.name') + ' (AR)'}><Input dir="rtl" /></Form.Item>
          </Space>
          <Space>
            <Form.Item name="date" label={t('common.date')} rules={[{ required: true }]}><DatePicker /></Form.Item>
            <Form.Item name="kind" label={t('settings.holidayKind')}>
              <Select options={['public', 'official', 'judicial', 'court', 'exceptional'].map((v) => ({ value: v, label: t(`settings.holidayKind.${v}`) }))} />
            </Form.Item>
          </Space>
          <Form.Item name="is_recurring_annual" valuePropName="checked" label={t('settings.recurringAnnual')}><Switch /></Form.Item>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function TaxonomyTab({ t, pick, can }) {
  const { message } = App.useApp();
  const [areas, setAreas] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [areaModal, setAreaModal] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [areaForm] = Form.useForm();
  const [statusForm] = Form.useForm();

  const load = () => {
    api('/admin/practice-areas').then(setAreas).catch(() => {});
    api('/cases/statuses').then(setStatuses).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const addArea = async () => {
    const v = await areaForm.validateFields();
    await api('/admin/practice-areas', { method: 'POST', body: v });
    message.success(t('common.save'));
    setAreaModal(false);
    areaForm.resetFields();
    load();
  };
  const addStatus = async () => {
    const v = await statusForm.validateFields();
    await api('/admin/case-statuses', { method: 'POST', body: v });
    message.success(t('common.save'));
    setStatusModal(false);
    statusForm.resetFields();
    load();
  };

  return (
    <div>
      <Card title={t('settings.caseStatuses')} size="small" style={{ marginBottom: 16 }}
        extra={can('settings.manage') && <Button size="small" icon={<PlusOutlined />} onClick={() => setStatusModal(true)}>{t('settings.newStatus')}</Button>}>
        <Table rowKey="id" dataSource={statuses} size="small" pagination={false}
          columns={[
            { title: 'Code', dataIndex: 'code', width: 160, render: (v, r) => <span className="mono">{v} {r.is_system ? <Tag color="blue">{t('settings.systemStatus')}</Tag> : null}</span> },
            { title: 'FR', dataIndex: 'name_fr' },
            { title: 'AR', dataIndex: 'name_ar', render: (v) => <span dir="rtl">{v}</span> },
            { title: t('settings.color'), dataIndex: 'color', width: 90, render: (v) => <Tag color={v}>{v}</Tag> }
          ]} />
      </Card>
      <Card title={t('settings.taxonomy')} size="small"
        extra={can('settings.manage') && <Button size="small" icon={<PlusOutlined />} onClick={() => setAreaModal(true)}>{t('settings.newArea')}</Button>}>
        <Table rowKey="id" dataSource={areas} size="small" pagination={false} scroll={{ y: 480 }}
          columns={[
            { title: t('common.name'), dataIndex: 'name_fr', render: (v, r) => (
              <span style={{ paddingInlineStart: r.parent_id ? 22 : 0 }}>
                {r.parent_id ? '↳ ' : ''}{pick(r, 'name')}
              </span>
            ) },
            { title: 'Code', dataIndex: 'code', width: 200, render: (v) => <span className="mono">{v}</span> },
            { title: t('settings.parentArea'), dataIndex: 'parent_name_fr', width: 200, render: (v) => v || '—' }
          ]} />
      </Card>

      <Modal title={t('settings.newArea')} open={areaModal} onOk={addArea} onCancel={() => setAreaModal(false)} okText={t('common.save')}>
        <Form form={areaForm} layout="vertical">
          <Form.Item name="name_fr" label={t('common.name') + ' (FR)'} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name_ar" label={t('common.name') + ' (AR)'} rules={[{ required: true }]}><Input dir="rtl" /></Form.Item>
          <Form.Item name="parent_id" label={t('settings.parentArea')}>
            <Select allowClear showSearch optionFilterProp="label" options={areas.filter((a) => !a.parent_id).map((a) => ({ value: a.id, label: pick(a, 'name') }))} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title={t('settings.newStatus')} open={statusModal} onOk={addStatus} onCancel={() => setStatusModal(false)} okText={t('common.save')}>
        <Form form={statusForm} layout="vertical">
          <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input className="mono" placeholder="custom_status" /></Form.Item>
          <Form.Item name="name_fr" label="FR" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name_ar" label="AR" rules={[{ required: true }]}><Input dir="rtl" /></Form.Item>
          <Form.Item name="color" label={t('settings.color')} initialValue="#1890ff"><Input type="color" style={{ width: 80, height: 32 }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function AuditTab({ t }) {
  const [rows, setRows] = useState([]);
  const [entity, setEntity] = useState('');
  useEffect(() => {
    api(`/admin/audit?limit=300${entity ? `&entity=${entity}` : ''}`).then(setRows).catch(() => {});
  }, [entity]);
  const entities = [...new Set(rows.map((r) => r.entity))];
  return (
    <Card>
      <Alert type="info" showIcon style={{ marginBottom: 14 }} message={t('settings.auditHint')} />
      <Select allowClear placeholder={t('common.type')} style={{ width: 200, marginBottom: 14 }}
        value={entity || undefined} onChange={(v) => setEntity(v || '')}
        options={entities.map((e) => ({ value: e, label: e }))} />
      <Table rowKey="id" dataSource={rows} size="small" pagination={{ pageSize: 50 }}
        columns={[
          { title: t('common.date'), dataIndex: 'created_at', width: 150, render: (v) => v?.slice(0, 19).replace('T', ' ') },
          { title: t('common.name'), dataIndex: 'user_name', width: 150 },
          { title: t('common.actions'), dataIndex: 'action', width: 120, render: (v) => <Tag color={v === 'delete' ? 'red' : v === 'create' ? 'green' : 'blue'}>{v}</Tag> },
          { title: t('common.type'), dataIndex: 'entity', width: 140 },
          { title: 'ID', dataIndex: 'entity_id', width: 90, render: (v) => v || '—' },
          { title: t('common.details'), dataIndex: 'details', ellipsis: true, render: (v) => <span className="mono">{v?.slice(0, 120)}</span> }
        ]} />
    </Card>
  );
}

function BackupTab({ t, can }) {
  return (
    <Card>
      <Alert type="info" showIcon style={{ marginBottom: 14 }} message={t('settings.backupHint')} />
      {can('backup.manage') ? (
        <Button type="primary" size="large" icon={<DownloadOutlined />} onClick={() => download('/admin/backup/export', `advocate-pro-backup-${dayjs().format('YYYY-MM-DD')}.json`)}>
          {t('settings.backupDownload')}
        </Button>
      ) : <Alert type="error" message={t('auth.forbidden')} />}
    </Card>
  );
}
