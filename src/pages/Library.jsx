/** Algerian legal library: texts & codes, articles (with version control), jurisprudence, sources. */
import React, { useEffect, useState } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, Select, Tag, App, Space, Card, Drawer,
  Descriptions, Alert, Timeline, List, Tooltip, Statistic, Row, Col, Popconfirm
} from 'antd';
import {
  PlusOutlined, BookOutlined, FileSearchOutlined, StarOutlined, StarFilled,
  HistoryOutlined, SafetyCertificateOutlined, LinkOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { PageHeader, VerifyBadge } from '../components/common.jsx';

const TEXT_KINDS = ['constitution', 'organic_law', 'law', 'ordinance', 'presidential_decree', 'executive_decree', 'ministerial_decree', 'code', 'regulation', 'circular', 'oj_publication', 'treaty', 'doctrine'];

export default function Library() {
  const { t, pick } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const { tab } = useParams();
  const loc = useLocation();
  const { message } = App.useApp();
  const activeTab = tab || 'texts';

  return (
    <div>
      <PageHeader title={t('library.title')} subtitle={t('library.subtitle')} />
      <Tabs
        activeKey={activeTab}
        onChange={(k) => nav(`/library/${k}`)}
        items={[
          { key: 'texts', label: <span><BookOutlined /> {t('library.texts')}</span>, children: <TextsTab t={t} pick={pick} can={can} /> },
          { key: 'jurisprudence', label: <span><FileSearchOutlined /> {t('library.jurisprudence')}</span>, children: <JurisprudenceTab t={t} pick={pick} can={can} /> },
          { key: 'sources', label: <span><SafetyCertificateOutlined /> {t('library.sources')}</span>, children: <SourcesTab t={t} pick={pick} can={can} /> }
        ]}
      />
    </div>
  );
}

/* ============================== TEXTS & ARTICLES ============================== */
function TextsTab({ t, pick, can }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ q: '', kind: '' });
  const [textDetail, setTextDetail] = useState(null);
  const [articleDetail, setArticleDetail] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [articleModal, setArticleModal] = useState(null);
  const [form] = Form.useForm();
  const [articleForm] = Form.useForm();
  const [sources, setSources] = useState([]);

  const load = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const data = await api(`/legal/texts?${params}&limit=100`);
    setRows(data.rows);
    setTotal(data.total);
  };
  useEffect(() => {
    load();
    api('/legal/sources').then(setSources).catch(() => {});
  }, [filters]);

  const columns = [
    { title: t('common.name'), dataIndex: 'title_fr', render: (v, r) => (
      <div>
        <a style={{ fontWeight: 600 }} onClick={() => api(`/legal/texts/${r.id}`).then(setTextDetail)}>{pick(r, 'title')}</a>
        <div style={{ fontSize: 12, color: '#8aa0b8' }}>{r.number} · {t(`library.kind.${r.kind}`)}</div>
      </div>
    ) },
    { title: t('library.kind'), dataIndex: 'kind', width: 140, render: (v) => <Tag color="geekblue">{t(`library.kind.${v}`)}</Tag> },
    { title: t('library.textDate'), dataIndex: 'date', width: 110, render: (v) => v || '—' },
    { title: t('library.ojNumber'), dataIndex: 'oj_number', width: 100, render: (v) => v || '—' },
    { title: t('library.status'), dataIndex: 'status', width: 110,
      render: (v) => <Tag color={v === 'in_force' ? 'green' : v === 'repealed' ? 'default' : 'orange'}>{t(`library.status.${v}`)}</Tag> },
    { title: t('library.articles'), dataIndex: 'articles_count', width: 80, align: 'center' },
    { title: t('library.verification'), dataIndex: 'verification_status', width: 120, render: (v) => <VerifyBadge status={v} /> },
    { title: t('common.source'), dataIndex: 'source_url', width: 70,
      render: (v) => v ? <a href={v} target="_blank" rel="noreferrer"><LinkOutlined /></a> : '—' }
  ];

  const submitText = async () => {
    const v = await form.validateFields();
    await api('/legal/texts', { method: 'POST', body: v });
    message.success(t('common.save'));
    setModalOpen(false);
    form.resetFields();
    load();
  };

  const submitArticle = async () => {
    const v = await articleForm.validateFields();
    await api(`/legal/texts/${articleModal.text_id}/articles`, { method: 'POST', body: v });
    message.success(t('common.save'));
    setArticleModal(null);
    articleForm.resetFields();
    if (textDetail?.id === articleModal.text_id) setTextDetail(await api(`/legal/texts/${articleModal.text_id}`));
    load();
  };

  const saveArticle = async () => {
    const v = await articleForm.validateFields();
    await api(`/legal/articles/${articleModal.id}`, { method: 'PUT', body: v });
    message.success(`${t('common.save')} — ${t('library.newVersionNote')}`);
    setArticleModal(null);
    setArticleDetail(await api(`/legal/articles/${articleModal.id}`));
  };

  return (
    <div>
      <Space wrap style={{ marginBottom: 14 }}>
        <Input.Search allowClear placeholder={t('common.search')} style={{ width: 260 }}
          onSearch={(v) => setFilters((f) => ({ ...f, q: v }))} />
        <Select allowClear placeholder={t('library.kind')} style={{ width: 180 }}
          options={TEXT_KINDS.map((k) => ({ value: k, label: t(`library.kind.${k}`) }))}
          onChange={(v) => setFilters((f) => ({ ...f, kind: v || '' }))} />
        {can('legal.edit') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>{t('library.newText')}</Button>}
      </Space>
      <Table rowKey="id" columns={columns} dataSource={rows} size="middle" pagination={{ pageSize: 50, total }} />

      {/* text detail with articles */}
      <Drawer title={textDetail ? pick(textDetail, 'title') : ''} open={!!textDetail} onClose={() => setTextDetail(null)} width={760}>
        {textDetail && (
          <>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={t('library.kind')}>{t(`library.kind.${textDetail.kind}`)}</Descriptions.Item>
              <Descriptions.Item label={t('library.number')}>{textDetail.number || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('library.textDate')}>{textDetail.date || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('library.publicationDate')}>{textDetail.publication_date || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('library.ojNumber')}>{textDetail.oj_number || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('library.subject')}>{textDetail.subject || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('library.status')}>{t(`library.status.${textDetail.status}`)}</Descriptions.Item>
              <Descriptions.Item label={t('library.verification')}><VerifyBadge status={textDetail.verification_status} /> {textDetail.source_url && <a href={textDetail.source_url} target="_blank" rel="noreferrer" style={{ marginInlineStart: 8 }}><LinkOutlined /> {textDetail.source_name_fr}</a>}</Descriptions.Item>
              {textDetail.notes && <Descriptions.Item label={t('common.notes')}>{textDetail.notes}</Descriptions.Item>}
            </Descriptions>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '14px 0 8px' }}>
              <b>{t('library.articlesOf')} ({textDetail.articles.length})</b>
              {can('legal.edit') && <Button size="small" icon={<PlusOutlined />} onClick={() => { setArticleModal({ text_id: textDetail.id }); articleForm.resetFields(); }}>{t('library.newArticle')}</Button>}
            </div>
            <List
              size="small" bordered
              dataSource={textDetail.articles}
              renderItem={(a) => (
                <List.Item actions={[<Button key="v" size="small" onClick={() => api(`/legal/articles/${a.id}`).then(setArticleDetail)}>{t('common.view')}</Button>]}>
                  <Space>
                    <b>{a.article_number}</b>
                    <span style={{ color: '#64748b' }}>{pick(a, 'title')}</span>
                    <VerifyBadge status={a.verification_status} />
                    {a.version > 1 && <Tag icon={<HistoryOutlined />}>v{a.version}</Tag>}
                  </Space>
                </List.Item>
              )}
            />
          </>
        )}
      </Drawer>

      {/* article detail with version history */}
      <Drawer title={articleDetail ? `${t('library.articleNumber')} ${articleDetail.article_number}` : ''} open={!!articleDetail} onClose={() => setArticleDetail(null)} width={720}>
        {articleDetail && (
          <>
            <Alert type={articleDetail.verification_status === 'demo' ? 'error' : articleDetail.body_fr || articleDetail.body_ar ? 'success' : 'warning'} showIcon style={{ marginBottom: 12 }}
              message={articleDetail.body_fr || articleDetail.body_ar ? '' : t('library.emptyArticle')} description={articleDetail.verification_status === 'demo' ? t('verify.demo') : undefined} />
            <Card size="small" title={`${t('library.bodyFr')} — ${t('library.currentVersion')} (v${articleDetail.version})`} style={{ marginBottom: 10 }}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{articleDetail.body_fr || t('library.emptyArticle')}</p>
            </Card>
            <Card size="small" title={t('library.bodyAr')} dir="rtl" style={{ marginBottom: 14 }}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{articleDetail.body_ar || 'النص غير مستورد بعد.'}</p>
            </Card>
            {can('legal.edit') && (
              <Button icon={<HistoryOutlined />} style={{ marginBottom: 12 }}
                onClick={() => { setArticleModal(articleDetail); articleForm.setFieldsValue({ ...articleDetail }); }}>
                {t('common.edit')} → {t('library.newVersionNote')}
              </Button>
            )}
            <Card size="small" title={<span><HistoryOutlined /> {t('library.versionHistory')}</span>}>
              <Timeline
                items={(articleDetail.versions || []).slice().reverse().map((v) => ({
                  color: v.version === articleDetail.version ? 'gold' : 'blue',
                  children: (
                    <div>
                      <b>{t('library.currentVersion')} v{v.version}</b>
                      {v.effective_date && <Tag style={{ marginInlineStart: 6 }}>{v.effective_date}</Tag>}
                      {v.modified_by && <Tag color="purple">{v.modified_by}</Tag>}
                      <div style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0' }}>{v.change_note}</div>
                      <div style={{ maxHeight: 90, overflow: 'hidden', fontSize: 12.5, color: '#94a3b8' }}>{(v.body_fr || v.body_ar || '').slice(0, 240)}</div>
                    </div>
                  )
                }))}
              />
            </Card>
          </>
        )}
      </Drawer>

      {/* new text modal */}
      <Modal title={t('library.newText')} open={modalOpen} onOk={submitText} onCancel={() => setModalOpen(false)} okText={t('common.save')} width={640}>
        <Form form={form} layout="vertical" initialValues={{ kind: 'law', status: 'in_force', verification_status: 'unverified' }}>
          <Form.Item name="title_fr" label={t('common.name') + ' (FR)'} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="title_ar" label={t('common.name') + ' (AR)'}><Input dir="rtl" /></Form.Item>
          <Space wrap>
            <Form.Item name="kind" label={t('library.kind')}>
              <Select style={{ width: 200 }} options={TEXT_KINDS.map((k) => ({ value: k, label: t(`library.kind.${k}`) }))} />
            </Form.Item>
            <Form.Item name="number" label={t('library.number')}><Input placeholder="Loi n° …" /></Form.Item>
            <Form.Item name="date" label={t('library.textDate')}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="publication_date" label={t('library.publicationDate')}><Input placeholder="YYYY-MM-DD" /></Form.Item>
            <Form.Item name="oj_number" label={t('library.ojNumber')}><Input /></Form.Item>
            <Form.Item name="subject" label={t('library.subject')}><Input /></Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="status" label={t('library.status')}>
              <Select style={{ width: 170 }} options={['in_force', 'modified', 'repealed', 'suspended', 'unknown'].map((v) => ({ value: v, label: t(`library.status.${v}`) }))} />
            </Form.Item>
            <Form.Item name="verification_status" label={t('library.verification')}>
              <Select style={{ width: 170 }} options={['official', 'imported', 'user_note', 'ai_suggestion', 'unverified'].map((v) => ({ value: v, label: t(`verify.${v}`) }))} />
            </Form.Item>
            <Form.Item name="source_id" label={t('common.source')}>
              <Select allowClear style={{ width: 220 }} options={sources.map((s) => ({ value: s.id, label: s.name_fr }))} />
            </Form.Item>
          </Space>
          <Form.Item name="source_url" label={t('library.sourceUrl')}><Input placeholder="https://www.joradp.dz/…" /></Form.Item>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* article modal (new or edit→new version) */}
      <Modal title={articleModal?.id ? t('library.editArticle') : t('library.newArticle')} open={!!articleModal}
        onOk={articleModal?.id ? saveArticle : submitArticle} onCancel={() => setArticleModal(null)} okText={t('common.save')} width={640}>
        {articleModal?.id && <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('library.newVersionNote')} />}
        <Form form={articleForm} layout="vertical" initialValues={{ status: 'in_force', verification_status: 'unverified' }}>
          <Space>
            <Form.Item name="article_number" label={t('library.articleNumber')} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="title_fr" label={t('common.name') + ' (FR)'}><Input /></Form.Item>
            <Form.Item name="title_ar" label={t('common.name') + ' (AR)'}><Input dir="rtl" /></Form.Item>
          </Space>
          <Form.Item name="body_fr" label={t('library.bodyFr')}><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="body_ar" label={t('library.bodyAr')}><Input.TextArea rows={6} dir="rtl" /></Form.Item>
          <Space wrap>
            <Form.Item name="status" label={t('common.status')}>
              <Select style={{ width: 160 }} options={['in_force', 'modified', 'repealed'].map((v) => ({ value: v, label: t(`library.status.${v}`) }))} />
            </Form.Item>
            <Form.Item name="modified_by" label={t('library.modifiedBy')}><Input placeholder="Loi n° …" /></Form.Item>
            <Form.Item name="modification_date" label={t('library.modificationDate')}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="verification_status" label={t('library.verification')}>
              <Select style={{ width: 170 }} options={['official', 'imported', 'user_note', 'ai_suggestion', 'unverified'].map((v) => ({ value: v, label: t(`verify.${v}`) }))} />
            </Form.Item>
            <Form.Item name="oj_number" label={t('library.ojNumber')}><Input /></Form.Item>
          </Space>
          <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/* ============================== JURISPRUDENCE ============================== */
function JurisprudenceTab({ t, pick, can }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ q: '', court_id: '' });
  const [courts, setCourts] = useState([]);
  const [detail, setDetail] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [recent, setRecent] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const data = await api(`/legal/jurisprudence?${params}&limit=100`);
    setRows(data.rows);
    setTotal(data.total);
  };
  const loadExtra = () => {
    api('/legal/jurisprudence/bookmarks').then(setBookmarks).catch(() => {});
    api('/legal/jurisprudence-recent').then(setRecent).catch(() => {});
  };
  useEffect(() => {
    load();
    loadExtra();
    api('/directory/courts').then(setCourts).catch(() => {});
  }, [filters]);

  const openDetail = async (id) => {
    const d = await api(`/legal/jurisprudence/${id}`);
    setDetail(d);
    loadExtra();
  };

  const toggleBookmark = async (r) => {
    if (r.bookmarked) await api(`/legal/jurisprudence/${r.id}/bookmark`, { method: 'DELETE' });
    else await api(`/legal/jurisprudence/${r.id}/bookmark`, { method: 'POST' });
    load();
    loadExtra();
    if (detail?.id === r.id) setDetail({ ...detail, bookmarked: !r.bookmarked });
  };

  const submit = async () => {
    const v = await form.validateFields();
    await api('/legal/jurisprudence', { method: 'POST', body: v });
    message.success(t('common.save'));
    setModalOpen(false);
    form.resetFields();
    load();
  };

  const columns = [
    { title: t('common.court'), dataIndex: 'court_name_fr', width: 170, render: (v, r) => pick(r, 'court_name') || '—' },
    { title: t('common.name'), dataIndex: 'subject', render: (v, r) => (
      <div>
        <a onClick={() => openDetail(r.id)} style={{ fontWeight: 600 }}>{v}</a>
        <div style={{ fontSize: 12, color: '#8aa0b8' }}>{r.chamber} · {r.decision_number} {r.decision_date ? `· ${r.decision_date}` : ''}</div>
      </div>
    ) },
    { title: t('library.verification'), dataIndex: 'verification_status', width: 120, render: (v) => <VerifyBadge status={v} /> },
    {
      title: '', width: 50,
      render: (r) => (
        <Button size="small" type="text" icon={r.bookmarked ? <StarFilled style={{ color: '#c9a227' }} /> : <StarOutlined />}
          onClick={() => toggleBookmark(r)} />
      )
    }
  ];

  return (
    <div>
      <Row gutter={14} style={{ marginBottom: 14 }}>
        {bookmarks.length > 0 && (
          <Col xs={24} md={12}>
            <Card size="small" title={<span><StarFilled style={{ color: '#c9a227' }} /> {t('library.bookmarks')} ({bookmarks.length})</span>}>
              {bookmarks.map((b) => (
                <div key={b.id} style={{ padding: '4px 0', cursor: 'pointer', borderBottom: '1px dashed #eef1f5' }} onClick={() => openDetail(b.id)}>
                  <b>{b.subject}</b> <span style={{ fontSize: 12, color: '#8aa0b8' }}>{b.court_name_fr}</span>
                </div>
              ))}
            </Card>
          </Col>
        )}
        {recent.length > 0 && (
          <Col xs={24} md={12}>
            <Card size="small" title={t('library.recentlyViewed')}>
              {recent.map((r) => (
                <div key={r.id} style={{ padding: '4px 0', cursor: 'pointer', borderBottom: '1px dashed #eef1f5' }} onClick={() => openDetail(r.id)}>
                  <b>{r.subject}</b> <span style={{ fontSize: 12, color: '#8aa0b8' }}>{r.viewed_at?.slice(0, 10)}</span>
                </div>
              ))}
            </Card>
          </Col>
        )}
      </Row>
      <Space wrap style={{ marginBottom: 14 }}>
        <Input.Search allowClear placeholder={t('common.search')} style={{ width: 260 }}
          onSearch={(v) => setFilters((f) => ({ ...f, q: v }))} />
        <Select allowClear showSearch optionFilterProp="label" placeholder={t('common.court')} style={{ width: 220 }}
          options={courts.map((c) => ({ value: c.id, label: pick(c, 'name') }))}
          onChange={(v) => setFilters((f) => ({ ...f, court_id: v || '' }))} />
        {can('legal.edit') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>{t('library.jurisprudenceNew')}</Button>}
      </Space>
      <Table rowKey="id" columns={columns} dataSource={rows} size="middle" pagination={{ pageSize: 50, total }} />

      <Drawer title={detail?.subject} open={!!detail} onClose={() => setDetail(null)} width={720}>
        {detail && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <VerifyBadge status={detail.verification_status} />
              {detail.bookmarked
                ? <Button size="small" icon={<StarFilled />} onClick={() => toggleBookmark(detail)}>{t('library.unbookmark')}</Button>
                : <Button size="small" icon={<StarOutlined />} onClick={() => toggleBookmark(detail)}>{t('library.bookmark')}</Button>}
              {detail.source_url && <a href={detail.source_url} target="_blank" rel="noreferrer"><LinkOutlined /> {t('library.sourceUrl')}</a>}
            </Space>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={t('common.court')}>{pick(detail, 'court_name') || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('library.chamber')}>{detail.chamber || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('library.decisionNumber')}>{detail.decision_number || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('library.decisionDate')}>{detail.decision_date || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('common.case') + ' #'}>{detail.case_number || '—'}</Descriptions.Item>
              {detail.keywords && <Descriptions.Item label={t('library.keywords')}>{detail.keywords}</Descriptions.Item>}
              {detail.principle_fr && <Descriptions.Item label={t('library.legalPrinciple')}>{detail.principle_fr}</Descriptions.Item>}
              {detail.summary_fr && <Descriptions.Item label={t('library.summary')}>{detail.summary_fr}</Descriptions.Item>}
              {detail.full_text_fr && <Descriptions.Item label={t('library.fullText')}><div style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>{detail.full_text_fr}</div></Descriptions.Item>}
            </Descriptions>
            {detail.related?.length > 0 && (
              <Card size="small" title={t('library.relatedDecisions')} style={{ marginTop: 12 }}>
                {detail.related.map((r) => (
                  <div key={r.id} style={{ padding: '4px 0', cursor: 'pointer', borderBottom: '1px dashed #eef1f5' }} onClick={() => openDetail(r.id)}>
                    <b>{r.subject}</b> <span style={{ fontSize: 12, color: '#8aa0b8' }}>{r.decision_number}</span>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </Drawer>

      <Modal title={t('library.jurisprudenceNew')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')} width={680}>
        <Form form={form} layout="vertical" initialValues={{ verification_status: 'unverified' }}>
          <Form.Item name="court_id" label={t('common.court')}>
            <Select allowClear showSearch optionFilterProp="label" options={courts.map((c) => ({ value: c.id, label: pick(c, 'name') }))} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="chamber" label={t('library.chamber')}><Input /></Form.Item>
            <Form.Item name="decision_number" label={t('library.decisionNumber')}><Input /></Form.Item>
            <Form.Item name="decision_date" label={t('library.decisionDate')}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          </Space>
          <Form.Item name="subject" label={t('common.name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="keywords" label={t('library.keywords')}><Input /></Form.Item>
          <Form.Item name="principle_fr" label={t('library.legalPrinciple')}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="summary_fr" label={t('library.summary')}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="full_text_fr" label={t('library.fullText')}><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="verification_status" label={t('library.verification')}>
            <Select style={{ width: 200 }} options={['official', 'imported', 'user_note', 'ai_suggestion', 'unverified'].map((v) => ({ value: v, label: t(`verify.${v}`) }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/* ============================== SOURCES ============================== */
function SourcesTab({ t, pick, can }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = () => api('/legal/sources').then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const v = await form.validateFields();
    if (editing) await api(`/legal/sources/${editing.id}`, { method: 'PUT', body: v });
    else await api('/legal/sources', { method: 'POST', body: v });
    message.success(t('common.save'));
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    load();
  };

  return (
    <div>
      {can('settings.manage') && <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 14 }} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>{t('library.sourcesNew')}</Button>}
      <Row gutter={[14, 14]}>
        {rows.map((s) => (
          <Col xs={24} md={12} xl={8} key={s.id}>
            <Card size="small" hoverable
              title={<span><SafetyCertificateOutlined style={{ color: '#2e7d32' }} /> {pick(s, 'name')}</span>}
              actions={can('settings.manage') ? [
                <Button key="e" type="text" size="small" onClick={() => { setEditing(s); form.setFieldsValue(s); setModalOpen(true); }}>{t('common.edit')}</Button>
              ] : undefined}>
              <p style={{ color: '#64748b', minHeight: 40 }}>{s.description}</p>
              {s.url ? <a href={s.url} target="_blank" rel="noreferrer"><LinkOutlined /> {s.url}</a> : <Tag color="orange">URL —</Tag>}
              <div style={{ marginTop: 8 }}>
                <Tag color="green">{t(`library.sourceKind.${s.kind}`)}</Tag>
                {s.last_verified_at ? <Tag>{t('library.lastVerified')}: {s.last_verified_at.slice(0, 10)}</Tag> : <Tag color="red">{t('verify.unverified')}</Tag>}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal title={editing ? t('library.sourcesEdit') : t('library.sourcesNew')} open={modalOpen} onOk={submit} onCancel={() => setModalOpen(false)} okText={t('common.save')}>
        <Form form={form} layout="vertical">
          <Form.Item name="name_fr" label={t('common.name') + ' (FR)'} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name_ar" label={t('common.name') + ' (AR)'}><Input dir="rtl" /></Form.Item>
          <Form.Item name="url" label="URL"><Input placeholder="https://…" /></Form.Item>
          <Form.Item name="kind" label={t('library.sourceKind')} initialValue="official">
            <Select options={['official', 'imported', 'other'].map((v) => ({ value: v, label: t(`library.sourceKind.${v}`) }))} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
