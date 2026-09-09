import React, { useState } from 'react';
import { Card, Form, Input, Button, App, Typography, Divider } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';

export default function Login() {
  const { t, lang, setLang } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const onFinish = async ({ username, password }) => {
    setLoading(true);
    try {
      await login(username, password);
      nav('/');
    } catch (e) {
      message.error(t('login.error'));
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <div className="login-hero" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '6vw', position: 'relative' }}>
        <div style={{ maxWidth: 520 }}>
          <div className="login-scale">⚖️</div>
          <Typography.Title level={2} style={{ color: '#fff', marginTop: 8, fontFamily: 'Georgia, serif' }}>
            ADVOCATE PRO <span style={{ color: 'var(--gold-400)' }}>ALGÉRIE</span>
          </Typography.Title>
          <Typography.Paragraph style={{ color: '#c9d6e8', fontSize: 16 }}>
            {t('app.tagline')} — نظام احترافي لإدارة مكتب المحاماة بالجزائر
          </Typography.Paragraph>
          <Divider style={{ borderColor: 'rgba(255,255,255,.15)' }} />
          <div style={{ color: '#93a9c4', fontSize: 13, lineHeight: 1.9 }}>
            <div>⚖️ {lang === 'fr' ? 'Dossiers · Audiences · Échéances procédurales' : 'الملفات · الجلسات · الآجال الإجرائية'}</div>
            <div>📚 {lang === 'fr' ? 'Bibliothèque juridique algérienne avec sources officielles' : 'مكتبة قانونية جزائرية بمصادر رسمية'}</div>
            <div>🏛️ {lang === 'fr' ? 'Annuaire judiciaire — 58 wilayas' : 'الدليل القضائي — 58 ولاية'}</div>
            <div>🔐 {lang === 'fr' ? 'Permissions granulaires · Journal d\'audit · Bilingue AR/FR' : 'صلاحيات دقيقة · سجل تدقيق · ثنائي اللغة'}</div>
          </div>
        </div>
        <Button
          type="text"
          style={{ position: 'absolute', top: 20, insetInlineEnd: 20, color: '#fff', fontWeight: 700 }}
          onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
        >
          {lang === 'fr' ? 'العربية 🌐' : 'Français 🌐'}
        </Button>
      </div>
      <div style={{ width: '45%', minWidth: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f5f6f8' }}>
        <Card style={{ width: '100%', maxWidth: 400, borderRadius: 14, boxShadow: '0 16px 48px rgba(14,42,71,.08)' }}>
          <Typography.Title level={4} style={{ marginTop: 0 }}>{t('login.title')}</Typography.Title>
          <Form layout="vertical" onFinish={onFinish} initialValues={{ username: 'admin', password: 'Admin@2026' }}>
            <Form.Item name="username" label={t('login.username')} rules={[{ required: true, message: t('common.required') }]}>
              <Input prefix={<UserOutlined />} size="large" />
            </Form.Item>
            <Form.Item name="password" label={t('login.password')} rules={[{ required: true, message: t('common.required') }]}>
              <Input.Password prefix={<LockOutlined />} size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              {t('login.submit')}
            </Button>
          </Form>
          <div style={{ marginTop: 18, padding: '10px 12px', background: '#faf3dd', borderRadius: 8, fontSize: 12.5, color: '#6b5b1e' }}>
            <b>{t('login.demo')} :</b>
            <div className="mono" style={{ marginTop: 4 }}>admin / Admin@2026</div>
            <div className="mono">maitre.amina · sara · rachid / Demo@2026</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
