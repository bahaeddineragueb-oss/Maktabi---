/**
 * Text normalization for bilingual (Arabic / French) full-text search.
 * - Arabic: removes diacritics (tashkeel) & tatweel, unifies alef forms (أ إ آ ٱ → ا),
 *   alef maqsura → ya (ى → ي), taa marbouta → ha (ة → ه), hamza carriers (ؤ → و, ئ → ي).
 * - French/Latin: strips accents (é è ê à ç ô ...) via NFD decomposition.
 * - Both: lowercase, collapse whitespace.
 */
function normalizeArabic(s) {
  if (!s) return '';
  return String(s)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '') // harakat, small alef, quranic marks, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '');
}

function normalizeLatin(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '') // combining diacritics (é→e, ç→c, ô→o …)
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
}

function normalizeForSearch(s) {
  if (s === null || s === undefined) return '';
  let out = normalizeArabic(s);
  out = normalizeLatin(out);
  return out
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build a normalized search blob from an object's text fields. */
function searchBlob(obj, fields) {
  return fields
    .map((f) => (obj[f] === null || obj[f] === undefined ? '' : String(obj[f])))
    .join(' · ');
}

module.exports = { normalizeArabic, normalizeLatin, normalizeForSearch, searchBlob };
