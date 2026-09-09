/**
 * Algerian legal calendar (holidays), procedural deadline-rule examples,
 * and document templates.
 *
 * HOLIDAY POLICY: fixed national holidays are seeded with the 'official' flag;
 * religious holidays depend on lunar observation — seeded as 'unverified'
 * (astronomical estimates) and must be confirmed by official announcement.
 * The calendar remains fully editable by authorized administrators.
 */
const dayjs = require('dayjs');
const YEAR = dayjs().year();

const HOLIDAYS = [
  // [name_ar, name_fr, date, kind, recurring_annual, verification]
  ['رأس السنة الميلادية', 'Nouvel an', `${YEAR}-01-01`, 'public', 1, 'official'],
  ['يَناير (رأس السنة الأمازيغية)', 'Yennayer (Nouvel an amazigh)', `${YEAR}-01-12`, 'public', 1, 'official'],
  ['عيد الفطر', 'Aïd El Fitr (1er jour)', `${YEAR}-03-20`, 'public', 0, 'unverified'],
  ['عيد الفطر (اليوم الثاني)', 'Aïd El Fitr (2e jour)', `${YEAR}-03-21`, 'public', 0, 'unverified'],
  ['عيد العمل', 'Fête du Travail', `${YEAR}-05-01`, 'public', 1, 'official'],
  ['عيد الأضحى', 'Aïd El Adha (1er jour)', `${YEAR}-05-27`, 'public', 0, 'unverified'],
  ['عيد الأضحى (اليوم الثاني)', 'Aïd El Adha (2e jour)', `${YEAR}-05-28`, 'public', 0, 'unverified'],
  ['فاتح محرم', 'Awal Muharram (Nouvel an hégirien)', `${YEAR}-06-16`, 'public', 0, 'unverified'],
  ['عاشوراء', 'Achoura', `${YEAR}-06-25`, 'public', 0, 'unverified'],
  ['عيد الاستقلال', 'Fête de l\'Indépendance', `${YEAR}-07-05`, 'public', 1, 'official'],
  ['المولد النبوي', 'Aïd El Mawlid Ennabaoui', `${YEAR}-08-25`, 'public', 0, 'unverified'],
  ['ذكرى ثورة أول نوفمبر', 'Anniversaire de la Révolution (1er Novembre)', `${YEAR}-11-01`, 'public', 1, 'official']
];

/**
 * Procedural deadline rule examples.
 * RULE INTEGRITY: none of these rules is legally verified. verified=0 means the
 * lawyer MUST configure/verify the legal basis before professional use. The UI
 * permanently displays "Calculated automatically — verify before relying on it."
 */
const DEADLINE_RULES = [
  {
    code: 'generic_15d', name_ar: 'دعوة عامة — 15 يوماً (للتهيئة)', name_fr: 'Délai générique — 15 jours (à configurer)',
    description: 'Exemple de règle calendaire à adapter et vérifier selon la procédure applicable.',
    amount: 15, unit: 'day', day_type: 'calendar', direction: 'forward', holiday_exclusion: 0,
    verified: 0, notes: 'Règle d\'exemple — vérifier le fondement légal avant utilisation.'
  },
  {
    code: 'generic_15d_open', name_ar: '15 يوماً (يوم عمل، مع استثناء الأعياد)', name_fr: '15 jours ouvrables (hors week-end et jours fériés)',
    description: 'Exemple de règle en jours ouvrables excluant week-end (vendredi-samedi) et jours fériés.',
    amount: 15, unit: 'day', day_type: 'business', direction: 'forward', holiday_exclusion: 1,
    verified: 0, notes: 'Règle d\'exemple — vérifier le fondement légal avant utilisation.'
  },
  {
    code: 'indicative_appeal_1m', name_ar: 'مهلة استئناف إرشادية — شهر واحد (غير محققة)', name_fr: 'Délai d\'appel indicatif — 1 mois (NON VÉRIFIÉ)',
    description: 'Valeur indicative à titre d\'exemple. La durée réelle dépend du type de procédure et des textes en vigueur.',
    amount: 1, unit: 'month', day_type: 'calendar', direction: 'forward', holiday_exclusion: 0,
    verified: 0, notes: 'Indicatif uniquement — configurer le fondement légal exact avant toute utilisation.'
  },
  {
    code: 'indicative_cassation_2m', name_ar: 'مهلة نقض إرشادية — شهران (غير محققة)', name_fr: 'Délai de cassation indicatif — 2 mois (NON VÉRIFIÉ)',
    description: 'Valeur indicative à titre d\'exemple. À vérifier impérativement selon la procédure.',
    amount: 2, unit: 'month', day_type: 'calendar', direction: 'forward', holiday_exclusion: 0,
    verified: 0, notes: 'Indicatif uniquement — configurer le fondement légal exact avant toute utilisation.'
  }
];

/**
 * Bilingual document templates with {{VARIABLES}}.
 */
const TEMPLATES = [
  {
    name_ar: 'خطاب — إشعار الموكل بجلسة',
    name_fr: 'Lettre — Notification d\'audience au client',
    category: 'client_notice', language: 'fr',
    body: `[En-tête du cabinet]
À l'attention de : {{CLIENT_NAME}}
Adresse : {{CLIENT_ADDRESS}}

Objet : {{CASE_TITLE}} — N° de dossier : {{CASE_NUMBER}}

Maître/Madame,

Nous avons l'honneur de vous informer qu'une audience sera tenue dans votre dossier devant {{COURT_NAME}} ({{WILAYA}}) le {{HEARING_DATE}}.

Type d'audience : {{CASE_TYPE}}

Nous vous prions de bien vouloir nous contacter préalablement afin de préparer cette audience et de vous munir des pièces utiles.

Veuillez agréer, Maître/Madame, l'expression de nos salutations distinguées.

{{LAWYER_NAME}}
Le {{DATE}}`
  },
  {
    name_ar: 'إشعار الموكل بجلسة (عربي)',
    name_fr: 'Notification d\'audience au client (arabe)',
    category: 'client_notice', language: 'ar',
    body: `[ترويسة المكتب]
إلى السيد(ة): {{CLIENT_NAME}}
العنوان: {{CLIENT_ADDRESS}}

الموضوع: {{CASE_TITLE}} — رقم الملف: {{CASE_NUMBER}}

تحية طيبة وبعد،

نبعث لكم هذا الإشعار لإعلامكم بأن جلسة ستنعقد في ملفكم أمام {{COURT_NAME}} ({{WILAYA}}) بتاريخ {{HEARING_DATE}}.

نوع الجلسة: {{CASE_TYPE}}

نرجو منكم الاتصال بنا قبل الجلسة لتحضيرها وإحضار الوثائق اللازمة.

وتقبلوا منا فائق الاحترام والتقدير.

{{LAWYER_NAME}}
في {{DATE}}`
  },
  {
    name_ar: 'إعذار (نموذج)',
    name_fr: 'Mise en demeure (modèle)',
    category: 'formal_notice', language: 'fr',
    body: `[En-tête du cabinet]
MISE EN DEMEURE

Destinataire : {{OPPOSING_PARTY}}
Objet : {{CASE_TITLE}} — Dossier n° {{CASE_NUMBER}}

Nous vous mettons en demeure, par la présente, de {{OBJET_A_PRECISER}} dans un délai de {{DELAI_A_PRECISER}} jours à compter de la réception de la présente.

À défaut d'exécution within ledit délai, toutes voies de droit seront engagées à votre encontre, sans autre formalité.

Fait à {{WILAYA}}, le {{DATE}}
{{LAWYER_NAME}}`
  },
  {
    name_ar: 'محضر جلسة (نموذج داخلي)',
    name_fr: 'Note d\'audience (modèle interne)',
    category: 'internal', language: 'fr',
    body: `NOTE D'AUDIENCE — DOCUMENT INTERNE

Dossier : {{CASE_TITLE}} (n° {{CASE_NUMBER}})
Juridiction : {{COURT_NAME}} — {{WILAYA}}
Date de l'audience : {{HEARING_DATE}}

Présents :
Conseil : {{LAWYER_NAME}}

Déroulement :
-

Observations et suites :
-

Rédigé le {{DATE}} par {{LAWYER_NAME}}.`
  },
  {
    name_ar: 'طلب إداري (نموذج)',
    name_fr: 'Lettre administrative (modèle)',
    category: 'administrative', language: 'fr',
    body: `[En-tête du cabinet]
À Monsieur/Madame le/la {{DESTINATAIRE}}

Objet : {{CASE_TITLE}}

Monsieur/Madame,

Dans le cadre du dossier référencé n° {{CASE_NUMBER}}, nous avons l'honneur de solliciter de votre haute bienveillance {{DEMANDE_A_PRECISER}}.

Dans l'attente d'une suite favorable, nous vous prions d'agréer, Monsieur/Madame, l'expression de notre considération distinguée.

{{LAWYER_NAME}}
Le {{DATE}}`
  }
];

module.exports = { HOLIDAYS, DEADLINE_RULES, TEMPLATES };
