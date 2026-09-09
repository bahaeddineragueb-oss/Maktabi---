/** Finance: invoices (with items/payments), expenses, accounting summary. */
import React, { useEffect, useState } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, Select, InputNumber, DatePicker, Tag, App,
  Space, Card, Statistic, Row, Col, Drawer, Descriptions, Popconfirm, List
} from 'antd';
import { PlusOutlined, PrinterOutlined, EuroOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader, DZD } from '../components/common.jsx';

export default function Finance() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('finance.title')} />
      <Tabs items={[
        { key: 'invoices', label: t('finance.invoices'), children: <InvoicesTab t={t} /> },
        { key: 'expenses', label: t('finance.expenses'), children: <ExpensesTab t={t} /> },
        { key: 'accounting', label: t('finance.accounting'), children: <AccountingTab t={t} /> }
      ]} />
    </div>
  );
}

const STATUS_TAG = (v, t) => {
  const key = `finance.status${v[0].toUpperCase() + v.slice(1)}`;
  const colors = { draft: 'default', sent: 'blue', partial: 'orange', paid: 'green', overdue: 'red', cancelled: 'default' };
  return <Tag color={colors[v]}>{t(key)}</Tag>;
};

function InvoicesTab({ t }) {
  const { can } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [cases, setCases] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();

  const load = async () => {
    setRows(await api('/finance/invoices?limit=200'));
  };
  useEffect(() => {
    load();
    api('/clients?limit=200').then((d) => setClients(d.rows)).catch(() => {});
    api('/cases?limit=200').then((d) => setCases(d.rows)).catch(() => {});
  }, []);

  const submit = async () => {
    const v = await form.validateFields();
    const body = {
      ...v,
      issue_date: v.issue_date?.format('YYYY-MM-DD'),
      due_date: v.due_date?.format('YYYY-MM-DD'),
      items: (v.items || []).map((it) => ({ ...it, quantity: Number(it.quantity) || 1, unit_price: Number(it.unit_price) || 0 }))
    };
    const res = await api('/finance/invoices', { method: 'POST', body });
    message.success(res.number);
    setModalOpen(false);
    form.resetFields();
    load();
  };

  const addPayment = async () => {
    const v = await payForm.validateFields();
    await api(`/finance/invoices/${paymentModal.id}/payments`, {
      method: 'POST',
      body: { ...v, amount: Number(v.amount), date: v.date?.format('YYYY-MM-DD') }
    });
    message.success(t('common.save'));
    setPaymentModal(null);
    payForm.resetFields();
    setDetail(await api(`/finance/invoices/${paymentModal.id}`));
    load();
  };

  const columns = [
    { title: t('finance.invoiceNumber'), dataIndex: 'number', width: 130, render: (v, r) => <a onClick={() => api(`/finance/invoices/${r.id}`).then(setDetail)} style={{ fontWeight: 700 }}>{v}</a> },
    { title: t('common.client'), dataIndex: 'client_name_fr', render: (v, r) => r.client_legal_name || v || '—' },
    { title: t('finance.issueDate'), dataIndex: 'issue_date', width: 110 },
    { title: t('finance.dueDate'), dataIndex: 'due_date', width: 110 },
    { title: t('common.status'), dataIndex: 'status', width: 120, render: (v) => STATUS_TAG(v, t) },
    { title: t('finance.totalTTC'), dataIndex: 'total', width: 130, align: 'right', render: (v) => <b>{DZD(v)}</b> },
    { title: t('finance.paid'), dataIndex: 'paid_amount', width: 120, align: 'right', render: (v) => DZD(v) },
    { title: t('finance.balance'), width: 130, align: 'right', render: (r) => <b style={{ color: r.total > r.paid_amount ? '#c0392b' : '#2e7d32' }}>{DZD(r.total - r.paid_amount)}</b> }
  ];

  return (
    <div>
      {can('finance.edit') && <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 14 }} onClick={() => setModalOpen(true)}>{t('finance.newInvoice')}</Button>}
      <Table rowKey="id" columns={columns} dataSource={rows} size="middle" pagination={{ pageSize: 50 }}
        onRow={(r) => ({ onClick: () => api(`/finance/invoices/${r.id}`).then(setDetail), style: { cursor: 'pointer' } })} />

      <Modal title={t('finance.newInvoice')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')} width={760}>
        <Form form={form} layout="vertical" initialValues={{ issue_date: dayjs(), tax_rate: 19, status: 'draft', items: [{ quantity: 1 }] }}>
          <Space wrap>
            <Form.Item name="client_id" label={t('common.client')} rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" style={{ width: 260 }} options={clients.map((c) => ({ value: c.id, label: c.legal_name || c.full_name_fr }))} />
            </Form.Item>
            <Form.Item name="case_id" label={t('common.case')}>
              <Select allowClear showSearch optionFilterProp="label" style={{ width: 260 }} options={cases.map((c) => ({ value: c.id, label: `${c.reference} — ${c.title_fr}` }))} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="issue_date" label={t('finance.issueDate')}><DatePicker /></Form.Item>
            <Form.Item name="due_date" label={t('finance.dueDate')}><DatePicker /></Form.Item>
            <Form.Item name="tax_rate" label={t('finance.taxRate')}><InputNumber min={0} max={100} /></Form.Item>
            <Form.Item name="status" label={t('common.status')}>
              <Select style={{ width: 150 }} options={['draft', 'sent'].map((v) => ({ value: v, label: t(`finance.status${v[0].toUpperCase() + v.slice(1)}`) }))} />
            </Form.Item>
          </Space>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => (
                  <Space key={f.key} align="baseline" wrap>
                    <Form.Item name={[f.name, 'description']} rules={[{ required: true }]}><Input placeholder={t('common.description')} style={{ width: 220 }} /></Form.Item>
                    <Form.Item name={[f.name, 'description_ar']}><Input dir="rtl" placeholder={t('finance.descriptionAr')} style={{ width: 180 }} /></Form.Item>
                    <Form.Item name={[f.name, 'quantity']} initialValue={1}><InputNumber min={0} placeholder={t('finance.qty')} style={{ width: 80 }} /></Form.Item>
                    <Form.Item name={[f.name, 'unit_price']} initialValue={0}><InputNumber min={0} placeholder={t('finance.unitPrice')} style={{ width: 120 }} /></Form.Item>
                    <Button onClick={() => remove(f.name)}>✕</Button>
                  </Space>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ quantity: 1, unit_price: 0 })} style={{ width: '100%' }}>{t('finance.addItem')}</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Drawer title={detail?.number} open={!!detail} onClose={() => setDetail(null)} width={620}
        extra={can('finance.edit') && detail && detail.total > detail.paid_amount && (
          <>
            {detail.status === 'draft' && <Button size="small" onClick={async () => { await api(`/finance/invoices/${detail.id}`, { method: 'PUT', body: { status: 'sent' } }); setDetail({ ...detail, status: 'sent' }); load(); }}>{t('finance.markSent')}</Button>}
            <Button size="small" type="primary" onClick={() => setPaymentModal(detail)}>{t('finance.addPayment')}</Button>
            <Button size="small" icon={<PrinterOutlined />} onClick={() => window.print()} />
          </>
        )}>
        {detail && (
          <>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={t('common.client')}>{detail.client_legal_name || detail.client_name_fr}</Descriptions.Item>
              <Descriptions.Item label={t('common.case')}>{detail.case_reference ? `${detail.case_reference} — ${detail.case_title_fr}` : '—'}</Descriptions.Item>
              <Descriptions.Item label={t('finance.issueDate')}>{detail.issue_date}</Descriptions.Item>
              <Descriptions.Item label={t('finance.dueDate')}>{detail.due_date || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>{STATUS_TAG(detail.status, t)}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title={t('finance.items')} style={{ marginTop: 12 }}>
              <Table size="small" rowKey="id" dataSource={detail.items} pagination={false}
                columns={[
                  { title: t('common.description'), dataIndex: 'description' },
                  { title: t('finance.qty'), dataIndex: 'quantity', width: 70, align: 'center' },
                  { title: t('finance.unitPrice'), dataIndex: 'unit_price', width: 110, align: 'right', render: DZD },
                  { title: t('common.total'), dataIndex: 'total', width: 120, align: 'right', render: DZD }
                ]} />
              <div style={{ textAlign: 'end', marginTop: 10, lineHeight: 1.9 }}>
                <div>{t('finance.subtotal')}: <b>{DZD(detail.subtotal)}</b></div>
                <div>{t('finance.tax')} ({detail.tax_rate}%): <b>{DZD(detail.tax_amount)}</b></div>
                <div style={{ fontSize: 16 }}>{t('finance.totalTTC')}: <b>{DZD(detail.total)}</b></div>
                <div>{t('finance.paid')}: <b style={{ color: '#2e7d32' }}>{DZD(detail.paid_amount)}</b></div>
                <div>{t('finance.balance')}: <b style={{ color: detail.total > detail.paid_amount ? '#c0392b' : '#2e7d32' }}>{DZD(detail.total - detail.paid_amount)}</b></div>
              </div>
            </Card>
            <Card size="small" title={t('finance.payments')} style={{ marginTop: 12 }}>
              {detail.payments.length === 0 && <span style={{ color: '#94a3b8' }}>—</span>}
              {detail.payments.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #eef1f5' }}>
                  <span>{p.date} · {t(`finance.method.${p.method}`)} {p.reference && `(${p.reference})`}</span>
                  <b>{DZD(p.amount)}</b>
                </div>
              ))}
            </Card>
          </>
        )}
      </Drawer>

      <Modal title={`${t('finance.addPayment')} — ${paymentModal?.number || ''}`} open={!!paymentModal} onOk={addPayment} onCancel={() => setPaymentModal(null)} okText={t('common.save')}>
        <Form form={payForm} layout="vertical" initialValues={{ date: dayjs(), method: 'bank_transfer' }}>
          <Form.Item name="amount" label={t('common.amount')} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="date" label={t('common.date')}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="method" label={t('finance.method')}>
            <Select options={['cash', 'bank_transfer', 'cheque', 'other'].map((v) => ({ value: v, label: t(`finance.method.${v}`) }))} />
          </Form.Item>
          <Form.Item name="reference" label={t('finance.reference')}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function ExpensesTab({ t }) {
  const { can } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [cases, setCases] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => setRows(await api('/finance/expenses?limit=200'));
  useEffect(() => {
    load();
    api('/cases?limit=200').then((d) => setCases(d.rows)).catch(() => {});
  }, []);

  const submit = async () => {
    const v = await form.validateFields();
    await api('/finance/expenses', { method: 'POST', body: { ...v, amount: Number(v.amount), date: v.date?.format('YYYY-MM-DD') } });
    message.success(t('common.save'));
    setModalOpen(false);
    form.resetFields();
    load();
  };

  return (
    <div>
      {can('finance.edit') && <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 14 }} onClick={() => setModalOpen(true)}>{t('finance.newExpense')}</Button>}
      <Table rowKey="id" dataSource={rows} size="middle" pagination={{ pageSize: 50 }}
        columns={[
          { title: t('common.date'), dataIndex: 'date', width: 105 },
          { title: t('finance.expenseCategory'), dataIndex: 'category', width: 130, render: (v) => <Tag>{v}</Tag> },
          { title: t('common.description'), dataIndex: 'description' },
          { title: t('common.case'), dataIndex: 'case_reference', width: 125, render: (v, r) => v || '—' },
          { title: t('common.amount'), dataIndex: 'amount', width: 120, align: 'right', render: (v) => <b>{DZD(v)}</b> },
          { title: t('finance.reimbursable'), dataIndex: 'reimbursable', width: 100, render: (v) => (v ? <Tag color="green">{t('common.yes')}</Tag> : '—') },
          { title: t('finance.billed'), dataIndex: 'billed', width: 90, render: (v) => (v ? <Tag color="blue">{t('common.yes')}</Tag> : '—') }
        ]} />
      <Modal title={t('finance.newExpense')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')}>
        <Form form={form} layout="vertical" initialValues={{ date: dayjs(), category: 'other' }}>
          <Form.Item name="description" label={t('common.description')} rules={[{ required: true }]}><Input /></Form.Item>
          <Space wrap>
            <Form.Item name="category" label={t('finance.expenseCategory')}>
              <Select style={{ width: 180 }} options={['greffe', 'deplacement', 'expertise', 'fournitures', 'loisir', 'other'].map((v) => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="amount" label={t('common.amount')} rules={[{ required: true }]}><InputNumber min={0} style={{ width: 150 }} /></Form.Item>
            <Form.Item name="date" label={t('common.date')}><DatePicker /></Form.Item>
          </Space>
          <Form.Item name="case_id" label={t('common.case')}>
            <Select allowClear showSearch optionFilterProp="label" options={cases.map((c) => ({ value: c.id, label: `${c.reference} — ${c.title_fr}` }))} />
          </Form.Item>
          <Form.Item name="reimbursable" valuePropName="checked" label={t('finance.reimbursable')}><Input type="checkbox" /></Form.Item>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function AccountingTab({ t }) {
  const [data, setData] = useState(null);
  useEffect(() => { api('/finance/summary').then(setData).catch(() => {}); }, []);
  if (!data) return null;
  const months = {};
  for (const r of data.byMonth) months[r.month] = { month: r.month, invoiced: r.invoiced, paid: r.paid };
  for (const r of data.expensesByMonth) (months[r.month] = months[r.month] || { month: r.month }).expenses = r.total;
  const chart = Object.values(months).map((m) => ({ ...m, invoiced: Math.round(m.invoiced), paid: Math.round(m.paid || 0), expenses: Math.round(m.expenses || 0) }));
  return (
    <div>
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title={t('finance.invoicedTotal')} value={DZD(data.totals.invoiced)} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title={t('finance.paidTotal')} value={DZD(data.totals.paid)} valueStyle={{ color: '#2e7d32' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title={t('finance.outstandingTotal')} value={DZD(data.totals.outstanding)} valueStyle={{ color: '#a06b00' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title={t('finance.overdueTotal')} value={DZD(data.totals.overdue.s)} suffix={`(${data.totals.overdue.c})`} valueStyle={{ color: '#c0392b' }} /></Card></Col>
      </Row>
      <Card size="small" title={t('finance.monthlyRevenue')} style={{ marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={11} />
            <RTooltip formatter={(v) => DZD(v)} />
            <Legend />
            <Bar dataKey="invoiced" name={t('finance.invoicedTotal')} fill="#143a61" radius={[4, 4, 0, 0]} />
            <Bar dataKey="paid" name={t('finance.paidTotal')} fill="#2e7d32" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name={t('finance.expensesTotal')} fill="#c0392b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Row gutter={[14, 14]}>
        <Col xs={24} md={12}>
          <Card size="small" title={t('finance.unpaidInvoices')}>
            {data.unpaidList.map((i) => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eef1f5' }}>
                <span><b>{i.number}</b> · {i.client_name || i.legal_name}</span>
                <b style={{ color: '#c0392b' }}>{DZD(i.total - i.paid_amount)}</b>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title={t('finance.expensesByCategory')}>
            {data.byCategory.map((c) => (
              <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eef1f5' }}>
                <Tag>{c.category}</Tag>
                <b>{DZD(c.total)}</b>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
