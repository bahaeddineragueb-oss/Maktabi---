/**
 * ADVOCATE PRO ALGÉRIE — Database seeder.
 * Usage:
 *   node server/seed/index.js --run    (seed if empty; --force to reseed demo data)
 *   node server/seed/index.js --reset  (drop & recreate schema, then seed)
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const { db, now, resetSchema, UPLOADS_DIR } = require('../db');
const { ROLE_DEFAULTS, PERMISSIONS } = require('../permissions');
const { normalizeForSearch } = require('../utils/normalize');
const { WILAYAS, COURT_TYPES, JUDICIAL_ENTITIES, CHAMBERS } = require('./data-directory');
const { PRACTICE_AREAS, CASE_STATUSES } = require('./data-taxonomy');
const { SOURCES, LEGAL_TEXTS, LEGAL_ARTICLES, JURISPRUDENCE, PLACEHOLDER_AR, PLACEHOLDER_FR } = require('./data-legal');
const { HOLIDAYS, DEADLINE_RULES, TEMPLATES } = require('./data-core');

const args = process.argv.slice(2);
if (args.includes('--reset')) resetSchema();

const T = (offsetDays, time) => {
  const d = dayjs().add(offsetDays, 'day');
  return time ? `${d.format('YYYY-MM-DD')}T${time}` : d.format('YYYY-MM-DD');
};
const Y = dayjs().year();
const ins = (table, obj) => {
  const keys = Object.keys(obj);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  const res = db.prepare(sql).run(...keys.map((k) => obj[k]));
  return res.lastInsertRowid;
};

// ---------------------------------------------------------------- settings
const DEFAULT_SETTINGS = {
  'firm.name.fr': 'Cabinet Bencheikh & Associés',
  'firm.name.ar': 'مكتب بن الشيخ وشركاؤه',
  'firm.address': 'Alger, Algérie',
  'firm.phone': '+213 (0) 00 00 00 00',
  'firm.email': 'contact@cabinet.dz',
  'app.default_language': 'fr',
  'app.disclaimer_enabled': 'true',
  'app.disclaimer_fr': "Cette application est un outil de gestion professionnelle destiné aux avocats. Les informations juridiques doivent être vérifiées sur les sources officielles en vigueur avant toute utilisation professionnelle ou procédurale.",
  'app.disclaimer_ar': 'هذا التطبيق أداة مهنية مخصصة لإدارة مكاتب المحامين. يجب التحقق دائماً من المعلومات القانونية والنصوص الرسمية السارية قبل اعتمادها في أي إجراء مهني أو قضائي.',
  'calendar.weekend_days': '[5,6]',
  'calendar.business_hours': '{"start":"08:00","end":"17:00"}',
  'finance.currency': 'DZD',
  'finance.tax_rate': '19',
  'modules.client_portal': 'false',
  'modules.ai_assistant': 'false',
  'deadline.auto_banner': 'true'
};
const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setSetting.run(k, v);

// ---------------------------------------------------------------- permissions
const insPerm = db.prepare('INSERT OR REPLACE INTO role_permissions (role, permission) VALUES (?,?)');
for (const [role, perms] of Object.entries(ROLE_DEFAULTS)) for (const p of perms) insPerm.run(role, p);

// ---------------------------------------------------------------- sources
const sourceIds = {};
{
  const q = db.prepare('INSERT INTO legal_sources (name_ar, name_fr, url, kind, description) VALUES (?,?,?,?,?)');
  for (const [ar, fr, url, kind, desc] of SOURCES) {
    sourceIds[fr] = q.run(ar, fr, url, kind, desc).lastInsertRowid;
  }
}
const srcMoJ = sourceIds["Ministère de la Justice (Algérie)"];
const srcJORADP = sourceIds['Journal Officiel de la République Algérienne (JORADP)'];

// ---------------------------------------------------------------- wilayas
const wilayaIds = {};
{
  const q = db.prepare('INSERT INTO wilayas (code, name_ar, name_fr, region, population, admin_status, notes, source_id) VALUES (?,?,?,?,?,?,?,?)');
  for (const [code, fr, ar, region] of WILAYAS) {
    const notes = parseInt(code, 10) >= 49 ? 'Wilaya créée par le découpage administratif de 2019 (loi n° 19-12).' : null;
    wilayaIds[code] = q.run(code, ar, fr, region, null, 'wilaya', notes, srcMoJ).lastInsertRowid;
  }
}

// ---------------------------------------------------------------- court types
const courtTypeIds = {};
{
  const q = db.prepare('INSERT INTO court_types (code, name_ar, name_fr, jurisdiction, level, notes) VALUES (?,?,?,?,?,?)');
  for (const [code, ar, fr, jur, level, notes] of COURT_TYPES) courtTypeIds[code] = q.run(code, ar, fr, jur, level, notes).lastInsertRowid;
}

// ---------------------------------------------------------------- judicial entities
const courtIds = {};
{
  const q = db.prepare(`INSERT INTO judicial_entities
    (entity_type_id, name_ar, name_fr, wilaya_id, municipality, parent_id, verification_status, source_id, jurisdiction, notes, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const [key, typeCode, ar, fr, wCode, municipality, parentKey, vstatus] of JUDICIAL_ENTITIES) {
    courtIds[key] = q.run(
      courtTypeIds[typeCode], ar, fr, wilayaIds[wCode], municipality,
      parentKey ? courtIds[parentKey] || null : null,
      vstatus, srcMoJ, null,
      'Entrée d\'illustration — à vérifier et compléter depuis l\'annuaire officiel du Ministère de la Justice.',
      now(), now()
    ).lastInsertRowid;
  }
}
// chambers for the documented example court
const chamberIds = {};
{
  const q = db.prepare('INSERT INTO chambers (court_id, name_ar, name_fr, kind, verification_status, notes) VALUES (?,?,?,?,?,?)');
  for (const [ar, fr, kind] of CHAMBERS.trib_sidi_mhamed) {
    chamberIds[kind] = q.run(courtIds.trib_sidi_mhamed, ar, fr, kind, 'unverified', 'Structure configurable — à confirmer auprès de la juridiction').lastInsertRowid;
  }
}

// ---------------------------------------------------------------- practice areas
const areaIds = {};
{
  const q = db.prepare('INSERT INTO practice_areas (code, name_ar, name_fr, parent_id, sort) VALUES (?,?,?,?,?)');
  let i = 0;
  for (const [code, ar, fr, parent] of PRACTICE_AREAS) {
    areaIds[code] = q.run(code, ar, fr, parent ? areaIds[parent] : null, i++).lastInsertRowid;
  }
}

// ---------------------------------------------------------------- case statuses
const statusIds = {};
{
  const q = db.prepare('INSERT INTO case_statuses (code, name_ar, name_fr, color, is_system, sort) VALUES (?,?,?,?,1,?)');
  for (const [code, ar, fr, color, sort] of CASE_STATUSES) statusIds[code] = q.run(code, ar, fr, color, sort).lastInsertRowid;
}

// ---------------------------------------------------------------- holidays
{
  const q = db.prepare('INSERT INTO holidays (name_ar, name_fr, date, kind, is_recurring_annual, verification_status, source_id, notes) VALUES (?,?,?,?,?,?,?,?)');
  for (const [ar, fr, date, kind, recurring, vstatus] of HOLIDAYS) {
    const notes = vstatus === 'unverified' ? 'Date prévisionnelle (estimation astronomique) — à confirmer par annonce officielle.' : null;
    q.run(ar, fr, date, kind, recurring, vstatus, srcMoJ, notes);
  }
}

// ---------------------------------------------------------------- deadline rules
{
  const q = db.prepare(`INSERT INTO deadline_rules
    (code, name_ar, name_fr, description, amount, unit, day_type, direction, holiday_exclusion, legal_basis, verified, source_id, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of DEADLINE_RULES) {
    q.run(r.code, r.name_ar, r.name_fr, r.description, r.amount, r.unit, r.day_type, r.direction, r.holiday_exclusion, r.legal_basis || null, r.verified, srcJORADP, r.notes);
  }
}

// ---------------------------------------------------------------- templates
{
  const q = db.prepare('INSERT INTO templates (name_ar, name_fr, category, language, body, created_at, updated_at) VALUES (?,?,?,?,?,?,?)');
  for (const t of TEMPLATES) q.run(t.name_ar, t.name_fr, t.category, t.language, t.body, now(), now());
}

// ---------------------------------------------------------------- users
const pass = (p) => bcrypt.hashSync(p, 10);
const users = {};
{
  const q = db.prepare(`INSERT INTO users
    (username, email, password_hash, full_name_ar, full_name_fr, role, bar_registration, bar_association, phone, specializations, languages, professional_status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const seedUsers = [
    ['admin', 'admin@cabinet.dz', 'Admin@2026', 'الأستاذ كريم بن الشيخ', 'Maître Karim Bencheikh', 'super_admin', '—', 'Barreau d\'Alger', '+213 555 000 001', 'Droit civil et immobilier; Droit commercial', 'ar; fr', 'active'],
    ['maitre.amina', 'amina@cabinet.dz', 'Demo@2026', 'الأستاذة أمينة حداد', 'Maître Amina Haddad', 'lawyer', '12345 (exemple)', 'Barreau d\'Alger', '+213 555 000 002', 'Droit de la famille; Droit civil', 'ar; fr', 'active'],
    ['maitre.yacine', 'yacine@cabinet.dz', 'Demo@2026', 'الأستاذ ياسين مكي', 'Maître Yacine Mekki', 'associate_lawyer', '12346 (exemple)', 'Barreau d\'Alger', '+213 555 000 003', 'Droit administratif; Contentieux fiscal', 'ar; fr', 'active'],
    ['sara', 'sara@cabinet.dz', 'Demo@2026', 'سارة بلقاسم', 'Sara Belkacem', 'legal_assistant', null, null, '+213 555 000 004', null, 'ar; fr', 'active'],
    ['nadia', 'nadia@cabinet.dz', 'Demo@2026', 'نادية فرحات', 'Nadia Ferhat', 'secretary', null, null, '+213 555 000 005', null, 'ar; fr', 'active'],
    ['rachid', 'rachid@cabinet.dz', 'Demo@2026', 'رشيد زروال', 'Rachid Zeroual', 'accountant', null, null, '+213 555 000 006', null, 'fr', 'active'],
    ['observateur', 'obs@cabinet.dz', 'Demo@2026', 'مراقب (قراءة فقط)', 'Observateur (lecture seule)', 'read_only', null, null, null, null, 'fr', 'active']
  ];
  for (const u of seedUsers) {
    const row = [...u];
    row[2] = pass(row[2]); // hash password
    users[u[0]] = q.run(...row, now(), now()).lastInsertRowid;
  }
}

// ================================================================ DEMO DATA
if (args.includes('--force') || args.includes('--reset') || db.prepare('SELECT COUNT(*) c FROM cases').get().c === 0) {
  // ---------------- clients
  const clients = {};
  {
    const q = db.prepare(`INSERT INTO clients
      (client_type, full_name_ar, full_name_fr, date_of_birth, place_of_birth, nationality, id_number, address, wilaya_id, municipality, phone, email, profession, notes, search_norm, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const individual = [
      ['محمد الطاهر بن سليمان', 'Mohamed Tahar Benslimane', '1978-03-12', 'Alger', 'Algérienne', '—', '12 Rue Didouche Mourad, Alger', '16', 'Alger Centre', '+213 661 111 111', 'm.benslimane@example.dz', 'Ingénieur', null],
      ['فاطمة الزهراء بلخير', 'Fatima Zohra Belkhir', '1985-07-30', 'Blida', 'Algérienne', '—', 'Cité 200 logements, Blida', '09', 'Blida', '+213 662 222 222', 'f.belkhir@example.dz', 'Enseignante', 'Contact d\'urgence : son frère +213 663 000 000'],
      ['عمر غوالي', 'Omar Ghouali', '1990-11-05', 'Sétif', 'Algérienne', '—', 'Rue de l\'Indépendance, Sétif', '19', 'Sétif', '+213 664 444 444', 'o.ghouali@example.dz', 'Technicien', null]
    ];
    for (const c of individual) {
      clients[c[1]] = q.run('individual', c[0], c[1], c[2], c[3], c[4], c[5], c[6], wilayaIds[c[7]], c[8], c[9], c[10], c[11], c[12], normalizeForSearch([c[0], c[1], c[6], c[9], c[10]].join(' ')), users.admin, now(), now()).lastInsertRowid;
    }
    const qc = db.prepare(`INSERT INTO clients
      (client_type, full_name_fr, legal_name, commercial_name, legal_form, rc, nif, nis, identifiers_note, address, wilaya_id, municipality, phone, email, notes, search_norm, created_by, created_at, updated_at)
      VALUES ('company',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    clients['Atlas BTP'] = qc.run(
      'Atlas BTP (SARL)', 'SARL Atlas Bâtiment Travaux Publics', 'Atlas BTP', 'SARL', null, null, null,
      'Identifiants RC / NIF / NIS à compléter lors de l\'onboarding (ne jamais inventer).',
      'Zone d\'activité Oued Smar, Alger', wilayaIds['16'], 'Oued Smar', '+213 21 55 55 55', 'contact@atlasbtp.example.dz',
      'Représentant légal : M. Réda Hamdi (gérant).',
      normalizeForSearch('Atlas BTP SARL Bâtiment Travaux Publics Oued Smar'), users.admin, now(), now()
    ).lastInsertRowid;
    clients['Med Distribution'] = qc.run(
      'Méditerranée Distribution (SPA)', 'SPA Méditerranée Distribution', 'Méditerranée Distribution', 'SPA', null, null, null,
      'Identifiants RC / NIF / NIS à compléter lors de l\'onboarding (ne jamais inventer).',
      'Port d\'Oran, Oran', wilayaIds['31'], 'Oran', '+213 41 66 66 66', 'contact@meddist.example.dz',
      'Représentante légale : Mme Leïla Amrani (PDG).',
      normalizeForSearch('Méditerranée Distribution SPA Oran port'), users.admin, now(), now()
    ).lastInsertRowid;
  }

  // ---------------- cases
  const cases = {};
  {
    const q = db.prepare(`INSERT INTO cases
      (reference, internal_number, court_file_number, title_ar, title_fr, client_id, opposing_party, opposing_lawyer, court_id, chamber_id, practice_area_id, case_type, judge, status_id, priority, opening_date, responsible_lawyer_id, assistant_id, next_action, last_action_at, notes, search_norm, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const seedCases = [
      {
        key: 'ref1', internal: `${Y}/0001`, courtFile: 'C.S 1457/2026',
        titleAr: 'نزاع عقاري — وعد بالبيع', titleFr: 'Litige immobilier — promesse de vente',
        client: 'Mohamed Tahar Benslimane', opposing: 'SARL El Djazair Immobilier', opposingLawyer: 'Maître R. Bourahla (conseil adverse)',
        court: 'trib_sidi_mhamed', chamber: 'civil', area: 'civil_real_estate', caseType: 'immobilier',
        status: 'hearing_scheduled', priority: 'high', opening: T(-86), lawyer: 'maitre.amina', assistant: 'sara',
        nextAction: 'Plaidoirie à préparer', lastAction: T(-1),
        notes: 'Promesse de vente non honorée — consignation versée.'
      },
      {
        key: 'ref2', internal: `${Y}/0002`, courtFile: 'P.F 892/2026',
        titleAr: 'طلاق ونفقة', titleFr: 'Divorce et pension alimentaire',
        client: 'Fatima Zohra Belkhir', opposing: 'N. Kaci', opposingLawyer: null,
        court: 'trib_sidi_mhamed', chamber: 'family', area: 'family_maintenance', caseType: 'famille',
        status: 'pending', priority: 'medium', opening: T(-129), lawyer: 'maitre.amina', assistant: null,
        nextAction: 'Conclusions à déposer', lastAction: T(-6), notes: null
      },
      {
        key: 'ref3', internal: `${Y}/0003`, courtFile: null,
        titleAr: 'تحصيل دين تجاري', titleFr: 'Recouvrement de créance commerciale',
        client: 'Atlas BTP', opposing: 'SARL Batimetal', opposingLawyer: 'Maître S. Lounis (conseil adverse)',
        court: 'commercial', chamber: null, area: 'commercial_disputes', caseType: 'commercial',
        status: 'filed', priority: 'high', opening: T(-20), lawyer: 'admin', assistant: 'sara',
        nextAction: 'Attendre la mise en état', lastAction: T(-3), notes: null
      },
      {
        key: 'ref4', internal: `${Y}/0004`, courtFile: null,
        titleAr: 'دعوى إلغاء — رخصة بناء', titleFr: 'Recours en annulation — permis de construire',
        client: 'Méditerranée Distribution', opposing: 'Commune de Bir Mourad Raïs', opposingLawyer: null,
        court: 'administratif', chamber: null, area: 'admin_cancellation', caseType: 'administratif',
        status: 'new', priority: 'medium', opening: T(-8), lawyer: 'maitre.yacine', assistant: null,
        nextAction: 'Rédiger la requête introductive', lastAction: T(-2), notes: null
      },
      {
        key: 'ref5', internal: `${Y}/0005`, courtFile: 'Soc 233/2025',
        titleAr: 'طرد تعسفي', titleFr: 'Licenciement abusif',
        client: 'Omar Ghouali', opposing: 'SPA Textile Oranais', opposingLawyer: 'Maître T. Hamdi (conseil adverse)',
        court: 'oran', chamber: null, area: 'labor_dismissal', caseType: 'social',
        status: 'appeal', priority: 'low', opening: T(-320), lawyer: 'admin', assistant: null,
        nextAction: 'Attendre la fixation de la date d\'appel', lastAction: T(-52),
        notes: 'Dossier en appel — vérifier les délais d\'appel (texte en vigueur).'
      }
    ];
    const resolveCourt = (k) => {
      if (k === 'commercial') return courtIds.tcom_alger;
      if (k === 'administratif') return courtIds.ta_alger;
      if (k === 'oran') return courtIds.trib_oran;
      return courtIds[k] || null;
    };
    for (const c of seedCases) {
      cases[c.key] = q.run(
        c.internal, c.internal, c.courtFile, c.titleAr, c.titleFr,
        clients[c.client], c.opposing, c.opposingLawyer,
        resolveCourt(c.court), c.chamber ? chamberIds[c.chamber] : null,
        areaIds[c.area], c.caseType, null, statusIds[c.status], c.priority, c.opening,
        users[c.lawyer], c.assistant ? users[c.assistant] : null,
        c.nextAction, c.lastAction, c.notes,
        normalizeForSearch([c.internal, c.courtFile, c.titleAr, c.titleFr, c.opposing, c.client].join(' ')),
        users.admin, now(), now()
      ).lastInsertRowid;
    }
  }

  // case team links
  db.prepare('INSERT OR REPLACE INTO case_lawyers (case_id, user_id, role) VALUES (?,?,?)').run(cases.ref1, users['maitre.yacine'], 'team');

  // ---------------- hearings
  {
    const q = db.prepare(`INSERT INTO hearings
      (case_id, court_id, chamber_id, date, time, hearing_type, lawyer_id, assistant_id, room, purpose, required_documents, status, notes, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    q.run(cases.ref1, courtIds.trib_sidi_mhamed, chamberIds.civil, T(0), '10:00', 'pleading', users['maitre.amina'], users.sara, 'Salle 3', 'Plaidoirie sur le fond', 'Dossier de plaidoirie; Promesse de vente; Preuve de consignation', 'scheduled', null, users.admin, now(), now());
    q.run(cases.ref1, courtIds.trib_sidi_mhamed, chamberIds.civil, T(14), '09:00', 'procedural', users['maitre.amina'], null, 'Salle 3', 'Mise en état', 'Conclusions échangées', 'scheduled', null, users.admin, now(), now());
    q.run(cases.ref2, courtIds.trib_sidi_mhamed, chamberIds.family, T(1), '09:30', 'family', users['maitre.amina'], null, 'Salle 7', 'Tentative de conciliation', 'Acte de mariage; Extraits de naissance', 'scheduled', null, users.admin, now(), now());
    q.run(cases.ref3, courtIds.tcom_alger, null, T(7), '11:00', 'commercial', users.admin, users.sara, '—', 'Première audience', 'Factures impayées; Contrat', 'scheduled', null, users.admin, now(), now());
    q.run(cases.ref5, courtIds.trib_oran || courtIds.trib_sidi_mhamed, null, T(-60), '09:00', 'appeal', users.admin, null, '—', 'Audience d\'appel', 'Jugement; Signification', 'held', 'Jugement mis en délibéré — Oral en audience. Vérifier la date de prononcé.', users.admin, now(), now());
  }

  // ---------------- deadlines
  {
    const q = db.prepare(`INSERT INTO deadlines
      (case_id, title_ar, title_fr, deadline_type, start_date, amount, unit, day_type, holiday_exclusion, end_date, is_computed, responsible_lawyer_id, priority, source, legal_basis, verification_status, status, notes, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    q.run(cases.ref1, 'إيداع مذكرات', 'Dépôt de conclusions', 'procedural', T(-10), 15, 'day', 'business', 1, T(2), 1, users['maitre.amina'], 'high', 'Configuration manuelle du cabinet', 'À vérifier selon le CPC et l\'état du dossier', 'unverified', 'active', null, users.admin, now(), now());
    q.run(cases.ref1, 'مهلة استئناف إرشادية', 'Délai d\'appel (indicatif — NON VÉRIFIÉ)', 'appeal', T(-1), 1, 'month', 'calendar', 0, T(29), 1, users['maitre.amina'], 'high', 'Règle indicative du moteur', 'NON VÉRIFIÉ — vérifier le texte applicable', 'unverified', 'active', 'Calcul automatique — à vérifier avant de s\'y fier.', users.admin, now(), now());
    q.run(cases.ref3, 'تقديم الوثائق', 'Production de pièces', 'procedural', T(-2), 7, 'day', 'calendar', 0, T(5), 1, users.admin, 'medium', 'Configuration manuelle du cabinet', 'À vérifier', 'unverified', 'active', null, users.admin, now(), now());
    q.run(cases.ref4, 'إعداد العريضة', 'Préparation de la requête introductive', 'procedural', T(0), 10, 'day', 'calendar', 0, T(10), 0, users['maitre.yacine'], 'medium', 'Décision interne', null, 'unverified', 'active', null, users.admin, now(), now());
  }

  // ---------------- tasks
  {
    const q = db.prepare(`INSERT INTO tasks
      (title, description, case_id, assigned_to, created_by, due_date, priority, status, search_norm, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    q.run('Vérifier le délai d\'appel applicable (textes en vigueur)', 'Contrôler la durée du délai d\'appel dans la procédure concernée au CPC/CPA avant toute signification.', cases.ref1, users['maitre.amina'], users.admin, T(-3), 'high', 'todo', normalizeForSearch('Vérifier délai appel textes'), now(), now());
    q.run('Préparer le dossier de plaidoirie', 'Compiler conclusions, pièces et sommaire pour l\'audience du jour.', cases.ref1, users['maitre.amina'], users.admin, T(0), 'high', 'in_progress', normalizeForSearch('Préparer dossier plaidoirie'), now(), now());
    q.run('Contacter le client — facture impayée', 'Relancer M. Benslimane concernant la facture INV échue.', cases.ref1, users.nadia, users.admin, T(3), 'medium', 'todo', normalizeForSearch('Contacter client facture'), now(), now());
    q.run('Rédiger la requête en annulation', 'Premier jet de la requête devant le tribunal administratif.', cases.ref4, users['maitre.yacine'], users.admin, T(5), 'high', 'todo', normalizeForSearch('Rédiger requête annulation'), now(), now());
    q.run('Ranger les pièces du dossier social', 'Numériser et classer les pièces du dossier Ghouali.', cases.ref5, users.sara, users.admin, T(-15), 'low', 'done', normalizeForSearch('Ranger pièces dossier social'), now(), now());
    db.prepare('UPDATE tasks SET completed_at=? WHERE status=?').run(now(), 'done');
  }

  // ---------------- events / appointments
  {
    const q = db.prepare(`INSERT INTO events (title, event_type, start_at, end_at, location, case_id, client_id, participants, notes, search_norm, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    q.run('Rendez-vous client — M. Benslimane', 'client_meeting', T(0, '14:00'), T(0, '15:00'), 'Cabinet — Bureau 1', cases.ref1, clients['Mohamed Tahar Benslimane'], JSON.stringify([users['maitre.amina'], users.nadia]), 'Point préalable à l\'audience.', normalizeForSearch('Rendez-vous client Benslimane'), users.admin, now(), now());
    q.run('Réunion interne — revue des dossiers', 'internal', T(2, '09:00'), T(2, '10:30'), 'Salle de réunion', null, null, JSON.stringify([users.admin, users['maitre.amina'], users['maitre.yacine']]), 'Revue hebdomadaire des échéances.', normalizeForSearch('Réunion interne revue dossiers'), users.admin, now(), now());
  }

  // ---------------- documents (2 with real demo files)
  {
    const q = db.prepare(`INSERT INTO documents
      (title, doc_type, client_id, case_id, file_path, original_name, mime_type, size, tags, ocr_text, notes, search_norm, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const demoDir = path.join(UPLOADS_DIR, 'seed');
    fs.mkdirSync(demoDir, { recursive: true });
    const f1 = path.join(demoDir, 'procuration-demo.txt');
    fs.writeFileSync(f1, 'DOCUMENT DE DÉMONSTRATION — Procuration (exemple). Remplacer par le document scanné officiel.\nوثيقة تجريبية — وكالة (مثال). يُستبدل بالمستند الرسمي الممسوح ضوئياً.');
    const f2 = path.join(demoDir, 'note-audience-demo.txt');
    fs.writeFileSync(f2, 'DOCUMENT DE DÉMONSTRATION — Note d\'audience (exemple interne).');
    q.run('Procuration — M. Benslimane (démo)', 'power_of_attorney', clients['Mohamed Tahar Benslimane'], cases.ref1, f1, 'procuration-demo.txt', 'text/plain', fs.statSync(f1).size, 'démo;procuration', null, 'Fichier de démonstration.', normalizeForSearch('Procuration Benslimane'), users.admin, now(), now());
    q.run('Note d\'audience — dossier social (démo)', 'correspondence', clients['Omar Ghouali'], cases.ref5, f2, 'note-audience-demo.txt', 'text/plain', fs.statSync(f2).size, 'démo;interne', null, 'Fichier de démonstration.', normalizeForSearch('Note audience Ghouali'), users.admin, now(), now());
    q.run('Jugement TPI — dossier social (métadonnées)', 'judgment', clients['Omar Ghouali'], cases.ref5, null, null, null, null, 'jugement;social', null, 'Référence enregistrée — fichier PDF à importer.', normalizeForSearch('Jugement TPI social Ghouali'), users.admin, now(), now());
    q.run('Statuts SARL Atlas BTP (métadonnées)', 'contract', clients['Atlas BTP'], null, null, null, null, null, 'statuts;société', null, 'Référence enregistrée — fichier à importer.', normalizeForSearch('Statuts SARL Atlas BTP'), users.admin, now(), now());
  }

  // ---------------- invoices & payments
  const invoices = {};
  {
    const q = db.prepare(`INSERT INTO invoices (number, client_id, case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total, paid_amount, currency, notes, search_norm, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const i1 = q.run(`INV-${Y}-001`, clients['Mohamed Tahar Benslimane'], cases.ref1, T(-20), T(-5), 'sent', 60000, 19, 11400, 71400, 0, 'DZD', null, normalizeForSearch('INV 001 Benslimane'), users.rachid, now(), now()).lastInsertRowid;
    const i2 = q.run(`INV-${Y}-002`, clients['Atlas BTP'], cases.ref3, T(-15), T(15), 'partial', 120000, 19, 22800, 142800, 60000, 'DZD', null, normalizeForSearch('INV 002 Atlas BTP'), users.rachid, now(), now()).lastInsertRowid;
    const i3 = q.run(`INV-${Y}-003`, clients['Méditerranée Distribution'], cases.ref4, T(-2), T(28), 'draft', 8000, 19, 1520, 9520, 0, 'DZD', null, normalizeForSearch('INV 003 Méditerranée'), users.rachid, now(), now()).lastInsertRowid;
    invoices.i1 = i1; invoices.i2 = i2; invoices.i3 = i3;
    const qi = db.prepare('INSERT INTO invoice_items (invoice_id, description, description_ar, quantity, unit_price, total, sort) VALUES (?,?,?,?,?,?,?)');
    qi.run(i1, 'Consultation juridique initiale', 'استشارة قانونية أولية', 1, 15000, 15000, 1);
    qi.run(i1, 'Rédaction de conclusions', 'تحرير مذكرات', 1, 45000, 45000, 2);
    qi.run(i2, 'Procédure de recouvrement — prestation', 'إجراءات التحصيل — أتعاب', 1, 120000, 120000, 1);
    qi.run(i3, 'Étude de faisabilité du recours', 'دراسة جدوى الطعن', 1, 8000, 8000, 1);
    const qp = db.prepare('INSERT INTO payments (invoice_id, amount, date, method, reference, created_by, created_at) VALUES (?,?,?,?,?,?,?)');
    qp.run(i2, 60000, T(-10), 'bank_transfer', 'VIR-2026-8842', users.rachid, now());
  }

  // ---------------- expenses
  {
    const q = db.prepare(`INSERT INTO expenses (case_id, client_id, category, description, amount, date, user_id, reimbursable, billed, search_norm, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    q.run(cases.ref1, clients['Mohamed Tahar Benslimane'], 'greffe', 'Frais de greffe — dépôt conclusions', 3000, T(-7), users['maitre.amina'], 1, 1, normalizeForSearch('Frais greffe conclusions'), users.rachid, now(), now());
    q.run(cases.ref5, clients['Omar Ghouali'], 'deplacement', 'Déplacement Oran — audience d\'appel', 15000, T(-60), users.admin, 1, 0, normalizeForSearch('Déplacement Oran audience'), users.rachid, now(), now());
    q.run(null, null, 'fournitures', 'Fournitures de bureau — trimestre', 8500, T(-40), users.nadia, 0, 0, normalizeForSearch('Fournitures bureau'), users.rachid, now(), now());
  }

  // ---------------- case events (timeline)
  {
    const q = db.prepare('INSERT INTO case_events (case_id, event_date, event_time, user_id, event_type, description, created_at) VALUES (?,?,?,?,?,?,?)');
    q.run(cases.ref1, T(-86), '10:00', users['maitre.amina'], 'consultation', 'Consultation client — M. Benslimane', now());
    q.run(cases.ref1, T(-84), null, users.sara, 'document', 'Procuration reçue et enregistrée', now());
    q.run(cases.ref1, T(-80), null, users['maitre.amina'], 'filing', 'Dépôt de la requête au greffe', now());
    q.run(cases.ref1, T(-10), null, users['maitre.amina'], 'note', 'Conclusions en cours de rédaction', now());
    q.run(cases.ref2, T(-129), null, users['maitre.amina'], 'consultation', 'Consultation cliente — Mme Belkhir', now());
    q.run(cases.ref3, T(-20), null, users.admin, 'filing', 'Assignation commerciale déposée', now());
  }

  // ---------------- notifications
  {
    const q = db.prepare('INSERT INTO notifications (user_id, kind, title_ar, title_fr, body_ar, body_fr, ref_type, ref_id, is_read, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
    q.run(users['maitre.amina'], 'task', 'مهمة جديدة: التحقق من مهلة الاستئناف', 'Nouvelle tâche : vérifier le délai d\'appel', 'تحقق من النصوص السارية قبل أي إجراء', 'Contrôler les textes en vigueur avant toute signification.', 'task', 1, 0, now());
    q.run(users.admin, 'invoice', 'فاتورة غير مسددة', 'Facture impayée', 'الفاتورة INV-2026-001 تجاوزت تاريخ الاستحقاق', 'La facture INV-2026-001 est échue.', 'invoice', 1, 0, now());
  }

  // ---------------- legal library
  const textIds = {};
  {
    const q = db.prepare(`INSERT INTO legal_texts
      (kind, title_ar, title_fr, number, date, subject, status, source_id, source_url, verification_status, notes, search_norm, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const t of LEGAL_TEXTS) {
      textIds[t.number] = q.run(t.kind, t.title_ar, t.title_fr, t.number, t.date, t.subject, 'in_force', srcJORADP, 'https://www.joradp.dz', 'unverified', t.notes, normalizeForSearch(`${t.title_fr} ${t.title_ar} ${t.number}`), now(), now()).lastInsertRowid;
    }
    const codeCivilId = textIds['Ordonnance n° 75-58'];
    const codeFamilleId = textIds['Loi n° 84-11'];
    const qa = db.prepare(`INSERT INTO legal_articles
      (text_id, article_number, title_ar, title_fr, body_ar, body_fr, status, source_id, verification_status, notes, search_norm, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    qa.run(codeCivilId, '1', 'المادة 1', 'Art. 1', PLACEHOLDER_AR, PLACEHOLDER_FR, 'in_force', srcJORADP, 'unverified', 'Placeholder — importer le texte officiel.', normalizeForSearch('Code civil article 1'), now(), now());
    qa.run(codeCivilId, '2', 'المادة 2', 'Art. 2', PLACEHOLDER_AR, PLACEHOLDER_FR, 'in_force', srcJORADP, 'unverified', 'Placeholder — importer le texte officiel.', normalizeForSearch('Code civil article 2'), now(), now());
    qa.run(codeFamilleId, '1', 'المادة 1', 'Art. 1', PLACEHOLDER_AR, PLACEHOLDER_FR, 'in_force', srcJORADP, 'unverified', 'Placeholder — importer le texte officiel.', normalizeForSearch('Code famille article 1'), now(), now());
    // DEMO article demonstrating version control (clearly flagged, fictitious)
    const demoId = qa.run(codeCivilId, '123 (DÉMO)', 'المادة 123 (تجريبية)', 'Art. 123 (DÉMO — contrôle de versions)', PLACEHOLDER_AR, PLACEHOLDER_FR, 'in_force', null, 'demo', 'Article fictif de démonstration du contrôle de versions — NE PAS UTILISER comme texte officiel.', normalizeForSearch('Démo article 123 versions'), now(), now()).lastInsertRowid;
    const qv = db.prepare('INSERT INTO legal_article_versions (article_id, version, body_ar, body_fr, effective_date, modified_by, change_note, created_at) VALUES (?,?,?,?,?,?,?,?)');
    qv.run(demoId, 1, 'النسخة الأصلية (نص تجريبي)', 'Version originale (texte fictif de démonstration)', '1975-09-26', '—', 'Version initiale (démo)', now());
    qv.run(demoId, 2, 'النسخة المعدلة (نص تجريبي)', 'Version modifiée — loi X (texte fictif de démonstration)', '2005-01-01', 'Loi X (fictive)', 'Modification de démonstration', now());
    qv.run(demoId, 3, PLACEHOLDER_AR, PLACEHOLDER_FR, null, null, 'Version courante non importée', now());
  }

  // ---------------- jurisprudence
  {
    const q = db.prepare(`INSERT INTO jurisprudence
      (court_id, chamber, decision_number, decision_date, subject, keywords, summary_ar, summary_fr, full_text_ar, full_text_fr, source_id, verification_status, notes, search_norm, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    q.run(courtIds.cour_supreme, 'Chambre civile', '(À compléter)', null, 'Exemple de fiche — Cour suprême', 'exemple; structure', 'ملخص تجريبي — يجب استبداله بقرار موثق', 'Fiche de démonstration — à remplacer par une décision vérifiée.', null, null, null, 'demo', 'Structure de démonstration uniquement.', normalizeForSearch('Exemple décision cour suprême'), now(), now());
    q.run(courtIds.conseil_etat, 'Chambre administrative', '(À compléter)', null, 'Exemple de fiche — Conseil d\'État', 'exemple; structure', 'ملخص تجريبي', 'Fiche de démonstration — à remplacer.', null, null, null, 'demo', 'Structure de démonstration uniquement.', normalizeForSearch('Exemple décision conseil état'), now(), now());
  }

  // ---------------- data conflict (registry demonstration)
  {
    const q = db.prepare('INSERT INTO data_conflicts (entity, entity_ref, field, value_a, value_b, source_a, source_b, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
    q.run('judicial_entity', 'Cour d\'Alger', 'address', '(Source A) Adresse non renseignée', '(Source B) Adresse divergente détectée lors d\'une importation', 'Annuaire A (à préciser)', 'Annuaire B (à préciser)', 'open', 'Exemple de conflit de données ouvert — l\'administrateur doit le résoudre depuis les sources officielles.', now());
  }
}

console.log('✅ Seed complete.');
console.log('   Users: admin / Admin@2026 — maitre.amina, maitre.yacine, sara, nadia, rachid, observateur / Demo@2026');
db.close();
