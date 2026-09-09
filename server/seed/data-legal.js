/**
 * Legal source registry + seed of the legal library.
 *
 * LEGAL INTEGRITY POLICY:
 * - Seeded legal texts reference only their well-established founding instruments
 *   (number/date). Full article bodies are NOT seeded with invented content:
 *   article bodies remain empty placeholders to be imported from official sources.
 * - Everything is flagged verification_status='unverified' until an administrator
 *   verifies it against an official source (JO, Ministry of Justice…).
 */
const SOURCES = [
  // [name_ar, name_fr, url, kind, description]
  ['وزارة العدل', 'Ministère de la Justice (Algérie)', 'https://www.mjustice.dz', 'official', 'Ministère de la Justice — annuaire officiel des juridictions et informations institutionnelles'],
  ['الجريدة الرسمية للجمهورية الجزائرية', 'Journal Officiel de la République Algérienne (JORADP)', 'https://www.joradp.dz', 'official', 'Publication officielle des textes législatifs et réglementaires'],
  ['المحكمة العليا', 'Cour suprême', 'https://www.coursupreme.dz', 'official', 'Juridiction de cassation — ordre judiciaire'],
  ['مجلس الدولة', "Conseil d'État", '', 'official', 'Juridiction suprême de l\'ordre administratif (URL à compléter)'],
  ['البوابة الجزائرية للمعلومات القانونية', 'Portail algérien de l\'information juridique', '', 'official', 'Portail juridique national (URL à compléter par l\'administrateur)'],
  ['المواقع الرسمية للمحاكم', 'Sites officiels des juridictions', '', 'official', 'Sites web officiels des cours et tribunaux (fiche par juridiction)'],
  ['مصادر أخرى معترف بها رسمياً', 'Autres institutions juridiques algériennes officiellement reconnues', '', 'official', 'Registre extensible — à compléter par l\'administrateur']
];

/**
 * Founding references of the main Algerian codes (well-established public
 * bibliographic facts). Versions / amendments must be verified in the JO.
 * kind: code | law | constitution | ordinance …
 */
const LEGAL_TEXTS = [
  {
    kind: 'constitution',
    title_ar: 'دستور الجزائر (المراجعة الدستورية 2020)',
    title_fr: 'Constitution de l\'Algérie (révision constitutionnelle du 1er novembre 2020)',
    number: 'Révision du 1er novembre 2020',
    date: '2020-11-01',
    subject: 'Droit constitutionnel',
    notes: 'Référence fondatrice. Vérifier la version consolidée au Journal Officiel.'
  },
  {
    kind: 'code',
    title_ar: 'القانون المدني',
    title_fr: 'Code civil',
    number: 'Ordonnance n° 75-58',
    date: '1975-09-26',
    subject: 'Droit civil',
    notes: 'Nombreuses modifications — vérifier la version consolidée en vigueur.'
  },
  {
    kind: 'code',
    title_ar: 'قانون الإجراءات المدنية والإدارية',
    title_fr: 'Code de procédure civile et administrative',
    number: 'Loi n° 08-09',
    date: '2008-02-25',
    subject: 'Procédure civile et administrative',
    notes: 'Délais procéduraux — vérifier les modifications au JO avant tout calcul.'
  },
  {
    kind: 'code',
    title_ar: 'قانون العقوبات',
    title_fr: 'Code pénal',
    number: 'Ordonnance n° 66-156',
    date: '1966-06-08',
    subject: 'Droit pénal'
  },
  {
    kind: 'code',
    title_ar: 'قانون الإجراءات الجزائية',
    title_fr: 'Code de procédure pénale',
    number: 'Ordonnance n° 66-155',
    date: '1966-06-08',
    subject: 'Procédure pénale'
  },
  {
    kind: 'code',
    title_ar: 'القانون التجاري',
    title_fr: 'Code de commerce',
    number: 'Ordonnance n° 75-59',
    date: '1975-09-26',
    subject: 'Droit commercial'
  },
  {
    kind: 'code',
    title_ar: 'قانون الأسرة',
    title_fr: 'Code de la famille',
    number: 'Loi n° 84-11',
    date: '1984-06-09',
    subject: 'Droit de la famille'
  },
  {
    kind: 'code',
    title_ar: 'قانون الجنسية',
    title_fr: 'Code de la nationalité',
    number: 'Ordonnance n° 70-86',
    date: '1970-12-15',
    subject: 'Droit de la nationalité'
  },
  {
    kind: 'law',
    title_ar: 'القانون المتعلق بعلاقات العمل',
    title_fr: 'Loi relative aux relations de travail',
    number: 'Loi n° 90-11',
    date: '1990-04-26',
    subject: 'Droit du travail'
  },
  {
    kind: 'law',
    title_ar: 'القانون المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي',
    title_fr: 'Loi relative à la protection des personnes physiques dans le traitement des données à caractère personnel',
    number: 'Loi n° 18-07',
    date: '2018-06-10',
    subject: 'Protection des données personnelles'
  }
];

/**
 * Articles are created as EMPTY placeholders (never invented text).
 * A clearly-flagged demonstration article shows how version control works.
 */
const PLACEHOLDER_AR = 'النص الرسمي لهذا المادة غير مستورد بعد. يجب استيراده من مصدر رسمي (الجريدة الرسمية) قبل أي استخدام مهني.';
const PLACEHOLDER_FR = 'Le texte officiel de cet article n\'a pas encore été importé. Il doit être importé depuis une source officielle (Journal Officiel) avant tout usage professionnel.';

const LEGAL_ARTICLES = [
  { code: 'code_civil', article_number: '1', title_fr: 'Art. 1', note: 'Placeholder — importer le texte officiel' },
  { code: 'code_civil', article_number: '2', title_fr: 'Art. 2', note: 'Placeholder — importer le texte officiel' },
  { code: 'code_famille', article_number: '1', title_fr: 'Art. 1', note: 'Placeholder — importer le texte officiel' },
  // Demonstration of the version-control mechanism (fictitious, clearly flagged):
  { code: 'DEMO', article_number: '123', title_fr: 'Art. 123 (DÉMO — contrôle de versions)', demo: true }
];

/**
 * Jurisprudence seed: structure only, clearly flagged — real decisions must be
 * imported/entered and verified. Never present AI/unverified content as official.
 */
const JURISPRUDENCE = [
  {
    court: 'cour_supreme',
    chamber: 'Chambre civile',
    decision_number: '(À compléter)',
    decision_date: null,
    subject: 'Exemple de fiche décision — structure de la base de données',
    demo: true
  },
  {
    court: 'conseil_etat',
    chamber: 'Chambre administrative',
    decision_number: '(À compléter)',
    decision_date: null,
    subject: 'Exemple de fiche décision — ordre administratif',
    demo: true
  }
];

module.exports = { SOURCES, LEGAL_TEXTS, LEGAL_ARTICLES, JURISPRUDENCE, PLACEHOLDER_AR, PLACEHOLDER_FR };
