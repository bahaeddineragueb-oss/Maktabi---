/** Shared UI primitives: page header, verification badge, status tag, priority tag. */
import React from 'react';
import { Tag, Tooltip } from 'antd';
import { useI18n } from '../i18n.jsx';

export function PageHeader({ title, subtitle, extra }) {
  return (
    <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1><span className="bar" />{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {extra && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{extra}</div>}
    </div>
  );
}

export function VerifyBadge({ status, withLabel = true }) {
  const { t } = useI18n();
  if (!status) return null;
  const labels = {
    official: { color: '#2e7d32', bg: '#e8f5e9' },
    imported: { color: '#1565c0', bg: '#e3f2fd' },
    user_note: { color: '#7b1fa2', bg: '#f3e5f5' },
    ai_suggestion: { color: '#ef6c00', bg: '#fff3e0' },
    unverified: { color: '#bf360c', bg: '#fbe9e7' },
    demo: { color: '#455a64', bg: '#eceff1' }
  };
  const cfg = labels[status] || labels.unverified;
  return (
    <Tooltip title={t('library.verification')}>
      <span className={`verify-badge verify-${status}`} style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + '55' }}>
        {t(`verify.${status}`)}
      </span>
    </Tooltip>
  );
}

export function PriorityTag({ value }) {
  const { t } = useI18n();
  const colors = { high: 'red', medium: 'orange', low: 'green' };
  return <Tag color={colors[value] || 'default'}>{t(`common.${value}`)}</Tag>;
}

export function DZD({ value, currency = 'DZD' }) {
  const n = Number(value) || 0;
  return `${n.toLocaleString('fr-FR')} ${currency}`;
}

export function hearingTypeOptions(t) {
  return ['first', 'procedural', 'pleading', 'criminal', 'civil', 'family', 'commercial', 'social', 'urgent', 'appeal', 'cassation', 'administrative', 'other']
    .map((v) => ({ value: v, label: t(`hearings.type.${v}`) }));
}

export function docTypeOptions(t) {
  return ['power_of_attorney', 'identity_document', 'lawsuit', 'defense_memo', 'response_memo', 'appeal', 'cassation_appeal',
    'correspondence', 'notice', 'formal_notice', 'contract', 'judgment', 'court_decision', 'expert_report', 'bailiff_report',
    'evidence', 'receipt', 'invoice', 'payment_proof', 'administrative_document', 'other'].map((v) => ({ value: v, label: t(`documents.type.${v}`) }));
}
