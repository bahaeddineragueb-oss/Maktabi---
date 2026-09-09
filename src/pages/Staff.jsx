/** Staff & user management with granular RBAC permission matrix. */
import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, App, Card, Drawer, Descriptions,
  List, Switch, Space, Typography, Popconfirm
} from 'antd';
import { PlusOutlined, SafetyOutlined, TeamOutlined } from '@ant-design/icons';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader } from '../components/common.jsx';

export default function Staff() {
  const { t, pick } = useI18n();
  const { can, user: me } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [permCatalog, setPermCatalog] = useState(null);
  const [detail, setDetail] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [form] = Form.useForm();

  const load = () => api('/admin/users').then(setRows).catch(() => {});
  useEffect(() => {
    load();
    api('/admin/permissions').then(setPermCatalog).catch(() => {});
  }, []);

  const submit = async () => {
    const v = await form.validateFields();
    const body = { ...v };
    if (!v.password) delete body.password;
    if (editing) await api(`/admin/users/${editing.id}`, { method: 'PUT', body });
    else await api('/admin/users', { method: 'POST', body });
    message.success(t('common.save'));
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    load();
  };

  const openDetail = async (id) => {
    const d = await api(`/admin/users/${id}`);
    setDetail(d);
    const ov = {};
    for (const o of d.permission_overrides) ov[o.permission] = !!o.allowed;
    setOverrides(ov);
  };

  const savePermissions = async () => {
    const list = Object.entries(overrides)
      .filter(([, v]) => v !== null)
      .map(([permission, allowed]) => ({ permission, allowed }));
    await api(`/admin/users/${detail.id}/permissions`, { method: 'PUT', body: { overrides: list } });
    message.success(t('common.save'));
    openDetail(detail.id);
  };

  const effectiveFor = (perm) => {
    if (!detail || !permCatalog) return false;
    if (overrides[perm] !== undefined && overrides[perm] !== null) return overrides[perm];
    return (permCatalog.role_defaults[detail.role] || []).includes(perm);
  };

  const columns = [
    { title: t('common.name'), dataIndex: 'full_name_fr', render: (v, r) => (
      <div>
        <a onClick={() => openDetail(r.id)} style={{ fontWeight: 600 }}>{pick(r, 'full_name') || r.username}</a>
        <div style={{ fontSize: 12, color: '#8aa0b8' }}>{r.username} · {r.email}</div>
      </div>
    ) },
    { title: t('staff.role'), dataIndex: 'role', width: 190, render: (v) => <Tag color={roleColor(v)}>{t(`staff.role.${v}`)}</Tag> },
    { title: t('staff.casesCount'), dataIndex: 'cases_count', width: 90, align: 'center' },
    { title: t('staff.lastLogin'), dataIndex: 'last_login_at', width: 150, render: (v) => v?.slice(0, 16).replace('T', ' ') || '—' },
    { title: t('staff.status'), dataIndex: 'is_active', width: 100, render: (v) => v ? <Tag color="green">{t('staff.active')}</Tag> : <Tag>{t('staff.inactive')}</Tag> },
    {
      title: t('common.actions'), width: 150, render: (r) => can('staff.manage') && (
        <Space>
          <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue({ ...r, password: undefined }); setModalOpen(true); }}>{t('common.edit')}</Button>
          {r.id !== me.id && (
            r.is_active
              ? <Popconfirm key="d" title={t('common.confirm')} onConfirm={async () => { await api(`/admin/users/${r.id}`, { method: 'DELETE' }); load(); }}>
                  <Button size="small" danger>{t('staff.deactivate')}</Button>
                </Popconfirm>
              : <Button size="small" onClick={async () => { await api(`/admin/users/${r.id}`, { method: 'PUT', body: { is_active: 1 } }); load(); }}>{t('staff.activate')}</Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title={t('staff.title')}
        subtitle={t('staff.subtitle')}
        extra={can('staff.manage') && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>{t('staff.newUser')}</Button>}
      />
      <Table rowKey="id" columns={columns} dataSource={rows} size="middle" pagination={false} />

      <Modal title={editing ? t('staff.editUser') : t('staff.newUser')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')} width={640}>
        <Form form={form} layout="vertical" initialValues={{ role: 'lawyer' }}>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="full_name_fr" label={t('common.name') + ' (FR)'} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="full_name_ar" label={t('common.name') + ' (AR)'} style={{ flex: 1 }}><Input dir="rtl" /></Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="username" label={t('staff.username')} rules={[{ required: true }]}><Input disabled={!!editing} /></Form.Item>
            <Form.Item name="email" label={t('common.email')}><Input /></Form.Item>
            <Form.Item name="role" label={t('staff.role')} rules={[{ required: true }]}>
              <Select style={{ width: 220 }} options={permCatalog ? permCatalog.roles.map((r) => ({ value: r, label: t(`staff.role.${r}`) })) : []} />
            </Form.Item>
          </Space>
          <Form.Item name="password" label={editing ? t('staff.resetPassword') : t('login.password')} rules={editing ? [] : [{ required: true }, { min: 8, message: '≥ 8' }]}>
            <Input.Password />
          </Form.Item>
          <Space wrap>
            <Form.Item name="phone" label={t('common.phone')}><Input /></Form.Item>
            <Form.Item name="bar_registration" label={t('staff.barRegistration')}><Input /></Form.Item>
            <Form.Item name="bar_association" label={t('staff.barAssociation')}><Input /></Form.Item>
          </Space>
          <Form.Item name="specializations" label={t('staff.specializations')}><Input placeholder="Droit civil; Droit commercial" /></Form.Item>
          <Form.Item name="languages" label={t('staff.languages')}><Input placeholder="ar; fr" /></Form.Item>
        </Form>
      </Modal>

      <Drawer title={detail ? `${pick(detail, 'full_name')} — ${t(`staff.role.${detail.role}`)}` : ''} open={!!detail}
        onClose={() => setDetail(null)} width={720}
        extra={can('staff.manage') && <Button type="primary" onClick={savePermissions}>{t('common.save')}</Button>}>
        {detail && permCatalog && (
          <>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('staff.username')}>{detail.username}</Descriptions.Item>
              <Descriptions.Item label={t('common.email')}>{detail.email || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('common.phone')}>{detail.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('staff.specializations')}>{detail.specializations || '—'}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title={t('staff.assignedCases')} style={{ marginBottom: 16 }}>
              {detail.cases.length === 0 && <span style={{ color: '#94a3b8' }}>—</span>}
              {detail.cases.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #eef1f5' }}>
                  <span><b>{c.reference}</b> — {c.title_fr}</span>
                  <Tag color={c.status_color}>{c.status_name_fr}</Tag>
                </div>
              ))}
            </Card>
            <Typography.Title level={5}><SafetyOutlined /> {t('staff.permissions')}</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
              {t('staff.permissionOverrides')} — ✓ / ✕ / défaut
            </Typography.Paragraph>
            <List
              size="small" bordered
              dataSource={permCatalog.permissions}
              renderItem={(perm) => {
                const defaultOn = (permCatalog.role_defaults[detail.role] || []).includes(perm);
                return (
                  <List.Item style={{ padding: '6px 12px' }}>
                    <span className="mono" style={{ flex: 1 }}>{perm}</span>
                    {defaultOn && <Tag color="blue">défaut ✓</Tag>}
                    <Switch
                      checkedChildren="✓"
                      unCheckedChildren="✕"
                      checked={effectiveFor(perm)}
                      disabled={!can('staff.manage')}
                      onChange={(v) => setOverrides((o) => ({ ...o, [perm]: v }))}
                    />
                  </List.Item>
                );
              }}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}

function roleColor(role) {
  return { super_admin: 'red', firm_owner: 'volcano', lawyer: 'geekblue', associate_lawyer: 'blue', legal_assistant: 'cyan', secretary: 'green', accountant: 'gold', read_only: 'default' }[role] || 'default';
}
