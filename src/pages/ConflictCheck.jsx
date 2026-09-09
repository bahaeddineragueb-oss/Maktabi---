/** Conflict-of-interest checker with traffic-light result. */
import React, { useState } from 'react';
import { Card, Form, Input, Button, List, Tag, Typography, App, Alert } from 'antd';
import { PlusOutlined, SearchOutlined, CheckCircleFilled, ExclamationCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader } from '../components/common.jsx';

export default function ConflictCheck() {
  const { t } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    const v = await form.validateFields();
    setLoading(true);
    try {
      const data = await api('/clients/check-conflicts', { method: 'POST', body: v });
      setResult(data);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  const LIGHTS = {
    green: { icon: <CheckCircleFilled style={{ fontSize: 42, color: '#4caf50' }} />, cls: 'conflict-green', title: t('conflict.green'), desc: t('conflict.greenDesc') },
    yellow: { icon: <ExclamationCircleFilled style={{ fontSize: 42, color: '#f2b124' }} />, cls: 'conflict-yellow', title: t('conflict.yellow'), desc: t('conflict.yellowDesc') },
    red: { icon: <CloseCircleFilled style={{ fontSize: 42, color: '#e53935' }} />, cls: 'conflict-red', title: t('conflict.red'), desc: t('conflict.redDesc') }
  };

  return (
    <div>
      <PageHeader title={t('conflict.title')} subtitle={t('conflict.subtitle')} />
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Card style={{ flex: 1, minWidth: 340, maxWidth: 520 }}>
          <Form form={form} layout="vertical">
            <Form.Item name="client_name" label={t('conflict.clientName')} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="opposing_party" label={t('conflict.opposingParty')}>
              <Input />
            </Form.Item>
            <Form.List name="related">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((f) => (
                    <Form.Item key={f.key} label={fields.length === f.key ? t('conflict.related') : ''} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Form.Item name={[f.name]} noStyle><Input /></Form.Item>
                        <Button onClick={() => remove(f.name)}>✕</Button>
                      </div>
                    </Form.Item>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} style={{ width: '100%' }}>
                    {t('conflict.addRelated')}
                  </Button>
                </>
              )}
            </Form.List>
            <Button type="primary" htmlType="submit" onClick={run} loading={loading} icon={<SearchOutlined />} block style={{ marginTop: 16 }} disabled={!can('conflict.check')}>
              {t('conflict.run')}
            </Button>
          </Form>
        </Card>

        <div style={{ flex: 1.4, minWidth: 340 }}>
          {result ? (
            <>
              <div className={`conflict-light ${LIGHTS[result.level].cls}`} style={{ marginBottom: 14 }}>
                {LIGHTS[result.level].icon}
                <Typography.Title level={4} style={{ margin: '10px 0 4px' }}>{LIGHTS[result.level].title}</Typography.Title>
                <Typography.Paragraph style={{ color: '#555' }}>{LIGHTS[result.level].desc}</Typography.Paragraph>
              </div>
              <Alert type="warning" showIcon message={t('conflict.disclaimer')} style={{ marginBottom: 14 }} />
              {result.matches.length > 0 && (
                <Card size="small" title={`${result.matches.length} ${t('common.results')}`}>
                  <List
                    size="small"
                    dataSource={result.matches}
                    renderItem={(m) => (
                      <List.Item>
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Tag color={m.severity === 'red' ? 'red' : 'gold'}>{m.severity.toUpperCase()}</Tag>
                            <b>{m.matched}</b>
                            {m.scope === 'case' && <Tag color="geekblue">{t('common.case')}</Tag>}
                            {m.scope === 'client' && <Tag color="green">{t('common.client')}</Tag>}
                          </div>
                          <div style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0' }}>{m.detail}</div>
                          {m.case_id && <a onClick={() => nav(`/cases/${m.case_id}`)}>{t('common.open')}</a>}
                        </div>
                      </List.Item>
                    )}
                  />
                </Card>
              )}
            </>
          ) : (
            <Card><Typography.Paragraph type="secondary">{t('conflict.subtitle')}</Typography.Paragraph></Card>
          )}
        </div>
      </div>
    </div>
  );
}
