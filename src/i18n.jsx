/**
 * Lightweight i18n engine.
 * Loads /locales/{lang}.json, supports instant AR (RTL) / FR (LTR) switching,
 * interpolation via {var}, and falls back to the key itself when missing.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const I18nContext = createContext(null);
const loaders = {
  fr: () => fetch('/locales/fr.json').then((r) => r.json()),
  ar: () => fetch('/locales/ar.json').then((r) => r.json())
};

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('advocate_lang') || 'fr');
  const [messages, setMessages] = useState({});

  useEffect(() => {
    let alive = true;
    loaders[lang]().then((m) => {
      if (alive) setMessages(m);
    });
    localStorage.setItem('advocate_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    return () => { alive = false; };
  }, [lang]);

  const setLang = useCallback((l) => {
    if (loaders[l]) setLangState(l);
  }, []);

  const t = useCallback(
    (key, params) => {
      let s = messages[key] !== undefined ? messages[key] : key;
      if (params) {
        for (const [k, v] of Object.entries(params)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
      return s;
    },
    [messages]
  );

  // pick a bilingual field: pick(row, 'name') → name_ar or name_fr depending on lang
  const pick = useCallback(
    (row, field) => {
      if (!row) return '';
      const suffix = lang === 'ar' ? '_ar' : '_fr';
      return row[`${field}${suffix}`] ?? row[field] ?? row[`${field === 'name' ? 'full_name' : field}${suffix}`] ?? '';
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, pick, rtl: lang === 'ar' }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
export default I18nContext;
