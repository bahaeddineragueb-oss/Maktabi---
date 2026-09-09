/** Judicial directory: wilayas registry, courts hierarchy, chambers, data conflicts. */
import React, { useEffect, useState } from 'react';
import {
  Tabs, Table, Card, Select, Input, Button, Modal, Form, Tag, App, Space, Drawer,
  Descriptions, List, Alert, Tree
} from 'antd';
import { PlusOutlined, BankOutlined, EnvironmentOutlined, PhoneOutlined, GlobalOutlined, WarningOutlined } from '@ant-design/icons';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader, VerifyBadge } from '../components/common.jsx';

export default function Directory() {
  const { t, pick } = useI18n();
  return (
    <div>
      <PageHeader title={t('directory.title')} subtitle={t('directory.subtitle')} />
      <Alert type="info" showIcon style={{ marginBottom: 14 }} message={t('directory.note')} />
      <Tabs items={[
        { key: 'courts', label: t('directory.courts'), children: <CourtsTab t={t} pick={pick} /> },
        { key: 'wilayas', label: t('directory.wilayas'), children: <WilayasTab t={t} pick={pick} /> },
        { key: 'conflicts', label: <span><WarningOutlined /> {t('directory.dataConflicts')}</span>, children: <ConflictsTab t={t} pick={pick} /> }
      ]} />
    </div>
  );
}

function CourtsTab({ t, pick }) {
  const { can } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [wilayas, setWilayas] = useState([]);
  const [types, setTypes] = useState([]);
  const [filters, setFilters] = useState({ wilaya_id: '', type_id: '', jurisdiction: '', q: '' });
  const [detail, setDetail] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [chamberModal, setChamberModal] = useState(null);
  const [form] = Form.useForm();
  const [chamberForm] = Form.useForm();

  const load = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    setRows(await api(`/directory/courts?${params}`));
  };
  useEffect(() => {
    load();
    api('/directory/wilayas').then(setWilayas).catch(() => {});
    api('/directory/court-types').then(setTypes).catch(() => {});
  }, [filters]);

  const submit = async () => {
    const v = await form.validateFields();
    await api('/directory/courts', { method: 'POST', body: v });
    message.success(t('common.save'));
    setModalOpen(false);
    form.resetFields();
    load();
  };

  const addChamber = async () => {
    const v = await chamberForm.validateFields();
    await api(`/directory/courts/${chamberModal.id}/chambers`, { method: 'POST', body: v });
    message.success(t('common.save'));
    setChamberModal(null);
    chamberForm.resetFields();
    setDetail(await api(`/directory/courts/${chamberModal.id}`));
    load();
  };

  // hierarchy tree: wilaya → court type → court
  const tree = {};
  for (const c of rows) {
    const w = c.wilaya_name_fr || '—';
    const k = c.type_fr || '—';
    (tree[w] = tree[w] || {})[k] = (tree[w][k] || []).concat(c);
  }

  return (
    <div>
      <Space wrap style={{ marginBottom: 14 }}>
        <Input.Search allowClear placeholder={t('common.search')} style={{ width: 230 }} onSearch={(v) => setFilters((f) => ({ ...f, q: v }))} />
        <Select allowClear showSearch optionFilterProp="label" placeholder={t('common.wilaya')} style={{ width: 180 }}
          options={wilayas.map((w) => ({ value: w.id, label: `${w.code} — ${pick(w, 'name')}` }))}
          onChange={(v) => setFilters((f) => ({ ...f, wilaya_id: v || '' }))} />
        <Select allowClear placeholder={t('directory.courtType')} style={{ width: 210 }}
          options={types.map((ty) => ({ value: ty.id, label: pick(ty, 'name') }))}
          onChange={(v) => setFilters((f) => ({ ...f, type_id: v || '' }))} />
        <Select allowClear placeholder={t('directory.jurisdictionKind')} style={{ width: 150 }}
          options={['ordinary', 'administrative', 'commercial', 'conflict'].map((v) => ({ value: v, label: t(`directory.jurisdictionKind.${v}`) }))}
          onChange={(v) => setFilters((f) => ({ ...f, jurisdiction: v || '' }))} />
        {can('directory.edit') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>{t('directory.newCourt')}</Button>}
      </Space>

      <Row2 tree={tree} onSelect={(id) => api(`/directory/courts/${id}`).then(setDetail)} pick={pick} t={t} />

      <Drawer title={detail ? pick(detail, 'name') : ''} open={!!detail} onClose={() => setDetail(null)} width={640}>
        {detail && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <VerifyBadge status={detail.verification_status} />
              <Tag color="geekblue">{detail.type_jurisdiction ? t(`directory.jurisdictionKind.${detail.type_jurisdiction}`) : ''}</Tag>
              {detail.type_fr && <Tag>{detail.type_fr}</Tag>}
            </Space>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={t('common.wilaya')}>{pick(detail, 'wilaya_name') || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('common.municipality')}>{detail.municipality || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('common.address')}>{detail.address || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('common.phone')}>{detail.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('common.email')}>{detail.email || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('directory.website')}>{detail.website || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('directory.parent')}>{detail.parent_name_fr || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('directory.openingHours')}>{detail.opening_hours || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('directory.gps')}>{detail.lat && detail.lng ? `${detail.lat}, ${detail.lng}` : '—'}</Descriptions.Item>
              <Descriptions.Item label={t('common.source')}>{detail.source_name_fr || '—'} {detail.last_verified_at ? `(${t('common.verifiedAt')} ${detail.last_verified_at.slice(0, 10)})` : ''}</Descriptions.Item>
              <Descriptions.Item label={t('common.notes')}>{detail.notes || '—'}</Descriptions.Item>
            </Descriptions>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '14px 0 8px' }}>
              <b>{t('directory.chambers')} ({detail.chambers.length})</b>
              {can('directory.edit') && <Button size="small" icon={<PlusOutlined />} onClick={() => setChamberModal(detail)}>{t('directory.addChamber')}</Button>}
            </div>
            <List size="small" bordered
              dataSource={detail.chambers}
              renderItem={(c) => (
                <List.Item>
                  <Space>
                    <b>{pick(c, 'name')}</b>
                    <Tag>{c.kind}</Tag>
                    <VerifyBadge status={c.verification_status} />
                  </Space>
                </List.Item>
              )}
            />
          </>
        )}
      </Drawer>

      <Modal title={t('directory.newCourt')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')} width={640}>
        <Form form={form} layout="vertical">
          <Space style={{ display: 'flex' }}>
            <Form.Item name="name_fr" label={t('common.name') + ' (FR)'} style={{ flex: 1 }} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="name_ar" label={t('common.name') + ' (AR)'} style={{ flex: 1 }} rules={[{ required: true }]}><Input dir="rtl" /></Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="entity_type_id" label={t('directory.courtType')} rules={[{ required: true }]}>
              <Select style={{ width: 240 }} showSearch optionFilterProp="label" options={types.map((ty) => ({ value: ty.id, label: `${pick(ty, 'name')} (${t(`directory.jurisdictionKind.${ty.jurisdiction}`)})` }))} />
            </Form.Item>
            <Form.Item name="wilaya_id" label={t('common.wilaya')}>
              <Select style={{ width: 200 }} allowClear showSearch optionFilterProp="label" options={wilayas.map((w) => ({ value: w.id, label: `${w.code} — ${pick(w, 'name')}` }))} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="municipality" label={t('common.municipality')}><Input /></Form.Item>
            <Form.Item name="parent_id" label={t('directory.parent')}>
              <Select style={{ width: 220 }} allowClear showSearch optionFilterProp="label" options={rows.map((c) => ({ value: c.id, label: pick(c, 'name') }))} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="phone" label={t('common.phone')}><Input /></Form.Item>
            <Form.Item name="email" label={t('common.email')}><Input /></Form.Item>
            <Form.Item name="website" label={t('directory.website')}><Input /></Form.Item>
          </Space>
          <Form.Item name="address" label={t('common.address')}><Input.TextArea rows={2} /></Form.Item>
          <Space wrap>
            <Form.Item name="lat" label="GPS lat"><Input type="number" /></Form.Item>
            <Form.Item name="lng" label="GPS lng"><Input type="number" /></Form.Item>
          </Space>
          <Form.Item name="jurisdiction" label={t('directory.jurisdiction')}><Input /></Form.Item>
          <Form.Item name="opening_hours" label={t('directory.openingHours')}><Input /></Form.Item>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={t('directory.addChamber')} open={!!chamberModal} onOk={addChamber} onCancel={() => setChamberModal(null)} okText={t('common.save')}>
        <Form form={chamberForm} layout="vertical">
          <Form.Item name="name_fr" label={t('common.name') + ' (FR)'} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name_ar" label={t('common.name') + ' (AR)'} rules={[{ required: true }]}><Input dir="rtl" /></Form.Item>
          <Form.Item name="kind" label={t('common.type')}><Input placeholder="civil, pénal, famille…" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function Row2({ tree, onSelect, pick, t }) {
  const treeData = Object.entries(tree).map(([wilaya, types]) => ({
    title: <b>{wilaya}</b>,
    key: `w-${wilaya}`,
    children: Object.entries(types).map(([type, courts]) => ({
      title: type,
      key: `t-${wilaya}-${type}`,
      children: courts.map((c) => ({
        title: (
          <span onClick={() => onSelect(c.id)} style={{ cursor: 'pointer' }}>
            {pick(c, 'name')} {c.verification_status !== 'official' && <Tag color="orange" style={{ marginInlineStart: 4 }}>⚠</Tag>}
          </span>
        ),
        key: `c-${c.id}`
      }))
    }))
  }));
  return <Card><Tree treeData={treeData} defaultExpandedKeys={[]} showLine blockNode /></Card>;
}

function WilayasTab({ t, pick }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { api('/directory/wilayas').then(setRows).catch(() => {}); }, []);
  const filtered = q ? rows.filter((w) => `${w.code} ${w.name_fr} ${w.name_ar} ${w.region || ''}`.toLowerCase().includes(q.toLowerCase())) : rows;
  return (
    <div>
      <Input.Search allowClear placeholder={t('common.search')} style={{ width: 250, marginBottom: 14 }} onChange={(e) => setQ(e.target.value)} />
      <Table rowKey="id" dataSource={filtered} size="small" pagination={{ pageSize: 58 }}>
        <Table.Column title={t('directory.code')} dataIndex="code" width={70} />
        <Table.Column title={t('common.name') + ' (FR)'} dataIndex="name_fr" />
        <Table.Column title={t('common.name') + ' (AR)'} dataIndex="name_ar" render={(v) => <span dir="rtl">{v}</span>} />
        <Table.Column title={t('directory.region')} dataIndex="region" width={110} render={(v) => <Tag>{v}</Tag>} />
        <Table.Column title={t('directory.courtsCount')} dataIndex="courts_count" width={100} align="center" />
        <Table.Column title={t('common.notes')} dataIndex="notes" ellipsis render={(v) => v || '—'} />
      </Table>
    </div>
  );
}

function ConflictsTab({ t, pick }) {
  const { can } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const load = () => api('/admin/data-conflicts').then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  const resolve = async (id, status) => {
    await api(`/admin/data-conflicts/${id}`, { method: 'PUT', body: { status, resolution: `Résolu par l'administrateur` } });
    message.success(t('common.save'));
    load();
  };
  return (
    <div>
      <Alert type="warning" showIcon style={{ marginBottom: 14 }} message={t('directory.dataConflictsHint')} />
      <List
        dataSource={rows}
        renderItem={(c) => (
          <List.Item actions={c.status === 'open' && can('settings.manage') ? [
            <Button key="r" size="small" type="primary" onClick={() => resolve(c.id, 'resolved')}>{t('directory.resolve')}</Button>,
            <Button key="d" size="small" onClick={() => resolve(c.id, 'dismissed')}>{t('directory.conflictDismissed')}</Button>
          ] : [<Tag key="s" color={c.status === 'resolved' ? 'green' : 'default'}>{t(`directory.conflict${c.status === 'resolved' ? 'Resolved' : c.status === 'dismissed' ? 'Dismissed' : 'Open'}`)}</Tag>]}>
            <div>
              <b>{c.entity} — {c.entity_ref}</b> <Tag>{t('common.name')}: {c.field}</Tag>
              <div style={{ fontSize: 12.5, color: '#64748b' }}>{c.value_a} ⇄ {c.value_b}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.source_a} / {c.source_b} · {c.notes}</div>
            </div>
          </List.Item>
        )}
      />
    </div>
  );
}
