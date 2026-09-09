/** Reports & statistics: charts across cases, courts, lawyers, revenue, deadlines. */
import React, { useEffect, useState } from 'react';
import { Card, Select, Row, Col, Table, Tag, Statistic } from 'antd';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { useI18n } from '../i18n.jsx';
import { api } from '../api.js';
import { PageHeader, DZD } from '../components/common.jsx';

const PALETTE = ['#143a61', '#c9a227', '#2e7d32', '#c0392b', '#6d3fa0', '#1b8ab3', '#a06b00', '#d35400', '#16a085', '#7f8c8d', '#2c3e50', '#8e44ad'];

export default function Reports() {
  const { t, pick } = useI18n();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState(null);

  useEffect(() => { api(`/insights/reports?year=${year}`).then(setData).catch(() => {}); }, [year]);
  if (!data) return null;

  const complianceTotal = data.deadlineCompliance.on_time + data.deadlineCompliance.late;

  return (
    <div>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        extra={<Select value={year} onChange={setYear} style={{ width: 100 }}
          options={[0, 1, 2].map((i) => ({ value: String(new Date().getFullYear() - i), label: String(new Date().getFullYear() - i) }))} />}
      />
      <Row gutter={[14, 14]}>
        <Col xs={24} lg={12}>
          <Card size="small" title={t('reports.casesByMonth')}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.casesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <RTooltip />
                <Bar dataKey="count" name={t('nav.cases')} fill="#143a61" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title={t('reports.hearingsByMonth')}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.hearingsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <RTooltip />
                <Bar dataKey="count" name={t('nav.hearings')} fill="#c9a227" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title={t('reports.byPracticeArea')}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.bySubArea} dataKey="count" nameKey="name_fr" innerRadius={50} outerRadius={100} paddingAngle={2}>
                  {data.bySubArea.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <RTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title={t('reports.revenueByMonth')}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={11} />
                <RTooltip formatter={(v) => DZD(v)} />
                <Legend />
                <Bar dataKey="invoiced" name={t('finance.invoicedTotal')} fill="#143a61" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" name={t('finance.paidTotal')} fill="#2e7d32" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card size="small" title={t('reports.deadlineCompliance')} style={{ marginTop: 14 }}>
            <Row>
              <Col span={12}><Statistic title={t('reports.onTime')} value={data.deadlineCompliance.on_time} valueStyle={{ color: '#2e7d32' }}
                suffix={complianceTotal ? ` (${Math.round((data.deadlineCompliance.on_time / complianceTotal) * 100)}%)` : ''} /></Col>
              <Col span={12}><Statistic title={t('reports.late')} value={data.deadlineCompliance.late} valueStyle={{ color: '#c0392b' }} /></Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title={t('reports.byCourt')}>
            <Table size="small" rowKey="name_fr" dataSource={data.byCourt} pagination={false}
              columns={[
                { title: t('common.court'), dataIndex: 'name_fr' },
                { title: t('directory.courtType'), dataIndex: 'type_name', width: 190, render: (v) => <Tag>{v}</Tag> },
                { title: t('nav.cases'), dataIndex: 'count', width: 80, align: 'center' }
              ]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title={t('reports.byLawyer')}>
            <Table size="small" rowKey="full_name_fr" dataSource={data.byLawyer} pagination={false}
              columns={[
                { title: t('common.lawyer'), dataIndex: 'full_name_fr', render: (v, r) => pick(r, 'full_name') },
                { title: t('nav.cases'), dataIndex: 'count', width: 80, align: 'center' }
              ]} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
