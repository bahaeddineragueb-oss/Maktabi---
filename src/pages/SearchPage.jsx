/** Advanced global search page (bilingual, normalized). */
import React, { useEffect, useState } from 'react';
import { Input, Select, Card, Tag, List, Typography, Alert, Empty, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { api } from '../api.js';
import { PageHeader } from '../components/common.jsx';

const TYPES = ['case', 'client', 'document', 'legal_text', 'legal_article', 'jurisprudence', 'court', 'task', 'contact', 'deadline'];

export default function SearchPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (q.length < 2) { setResults(null); return; }
    const id = setTimeout(() => {
      api(`/insights/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}`).then((d) => setResults(d.results)).catch(() => {});
    }, 300);
    return () => clearTimeout(id);
  }, [q, type]);

  const colors = { case: 'geekblue', client: 'green', document: 'orange', legal_text: 'purple', legal_article: 'magenta', jurisprudence: 'volcano', court: 'cyan', task: 'gold', contact: 'blue', deadline: 'red' };

  return (
    <div>
      <PageHeader title={t('search.title')} subtitle={t('search.subtitle')} />
      <Alert type="info" showIcon style={{ marginBottom: 14 }} message={t('search.hint')} />
      <Space.Compact style={{ width: '100%', maxWidth: 720, marginBottom: 18 }}>
        <Input size="large" allowClear prefix={<SearchOutlined />} placeholder={t('search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select size="large" value={type} onChange={setType} style={{ minWidth: 160 }}
          options={[{ value: '', label: t('search.typeAll') }, ...TYPES.map((v) => ({ value: v, label: t(`search.type.${v}`) }))]} />
      </Space.Compact>
      {results === null && <Card><Typography.Paragraph type="secondary">{t('search.hint')}</Typography.Paragraph></Card>}
      {results && results.length === 0 && <Empty description={t('search.noResults')} />}
      {results && results.length > 0 && (
        <Card>
          <Typography.Paragraph><b>{results.length}</b> {t('common.results')}</Typography.Paragraph>
          <List
            dataSource={results}
            renderItem={(r) => (
              <List.Item style={{ cursor: 'pointer' }} onClick={() => nav(r.route)}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Tag color={colors[r.type]}>{t(`search.type.${r.type}`)}</Tag>
                    <b>{r.title}</b>
                    {r.badge && <Tag>{r.badge}</Tag>}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#8aa0b8', margin: '3px 0' }}>{r.sub}</div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
}
