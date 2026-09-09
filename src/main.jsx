import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme, App as AntApp } from 'antd';
import frFR from 'antd/locale/fr_FR';
import arEG from 'antd/locale/ar_EG';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import 'dayjs/locale/ar';
import App from './App.jsx';
import { I18nProvider, useI18n } from './i18n.jsx';
import { AuthProvider } from './auth.jsx';
import './theme.css';

function Root() {
  const { lang, rtl } = useI18n();
  dayjs.locale(lang === 'ar' ? 'ar' : 'fr');
  return (
    <ConfigProvider
      locale={lang === 'ar' ? arEG : frFR}
      direction={rtl ? 'rtl' : 'ltr'}
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#143a61',
          colorInfo: '#143a61',
          borderRadius: 8,
          fontFamily: "'Segoe UI', 'Tahoma', 'Noto Sans Arabic', sans-serif",
          colorLink: '#1b4a7c'
        },
        components: {
          Menu: { darkItemBg: 'transparent', darkItemSelectedBg: '#c9a227', darkItemSelectedColor: '#0e2a47', darkItemColor: '#c7d4e6', darkItemHoverColor: '#fff', darkItemHoverBg: 'rgba(255,255,255,.06)' },
          Table: { headerBg: '#f2f5f9', headerColor: '#0e2a47', fontWeightStrong: 600 }
        }
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
