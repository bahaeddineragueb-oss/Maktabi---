/**
 * ADVOCATE PRO ALGÉRIE — Database layer
 * Gestion cabinet d'avocats — Algérie / نظام إدارة مكتب المحامي — الجزائر
 *
 * Driver-agnostic SQLite layer:
 *  - prefers `better-sqlite3` when installed (development / Linux / macOS)
 *  - falls back to Node's built-in `node:sqlite` (portable Windows build — no
 *    native compilation required; Node >= 22.5)
 * Both expose the same prepare/run/get/all/exec/pragma/transaction surface used
 * throughout the application.
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.ADV_DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOADS_DIR = process.env.ADV_UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

let db;
let DRIVER;

try {
  const Database = require('better-sqlite3');
  DRIVER = 'better-sqlite3';
  db = new Database(path.join(DATA_DIR, 'advocate.db'));
} catch (e) {
  // Portable build: built-in SQLite (Node >= 22.5), wrapped for API compatibility.
  const { DatabaseSync } = require('node:sqlite');
  DRIVER = 'node:sqlite (built-in)';
  class CompatibleDatabase extends DatabaseSync {
    pragma(sql) { return this.exec(`PRAGMA ${sql}`); }
    // better-sqlite3 binds `undefined` as NULL; node:sqlite throws. Normalize
    // so both drivers behave identically across the whole application.
    prepare(sql) {
      const stmt = super.prepare(sql);
      const norm = (args) => args.map((a) => (a === undefined ? null : a));
      return {
        run: (...args) => stmt.run(...norm(args)),
        get: (...args) => stmt.get(...norm(args)),
        all: (...args) => stmt.all(...norm(args)),
        iterate: (...args) => stmt.iterate(...norm(args)),
        raw: () => stmt,
        source: sql
      };
    }
    transaction(fn) {
      return (...args) => {
        this.exec('BEGIN');
        try {
          const result = fn(...args);
          this.exec('COMMIT');
          return result;
        } catch (err) {
          this.exec('ROLLBACK');
          throw err;
        }
      };
    }
  }
  db = new CompatibleDatabase(path.join(DATA_DIR, 'advocate.db'));
}
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------- schema
const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  full_name_ar TEXT,
  full_name_fr TEXT,
  role TEXT NOT NULL DEFAULT 'lawyer',
  bar_registration TEXT,
  bar_association TEXT,
  phone TEXT,
  address TEXT,
  specializations TEXT,
  languages TEXT,
  professional_status TEXT DEFAULT 'active',
  photo_path TEXT,
  signature_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  PRIMARY KEY (role, permission)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INTEGER NOT NULL,
  permission TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, permission)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  ip TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS legal_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT,
  name_fr TEXT,
  url TEXT,
  kind TEXT NOT NULL DEFAULT 'official',
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_verified_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS wilayas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  region TEXT,
  population INTEGER,
  admin_status TEXT DEFAULT 'wilaya',
  notes TEXT,
  source_id INTEGER,
  last_verified_at TEXT
);

CREATE TABLE IF NOT EXISTS court_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT 'ordinary',
  level INTEGER DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS judicial_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type_id INTEGER REFERENCES court_types(id),
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  wilaya_id INTEGER REFERENCES wilayas(id),
  municipality TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  lat REAL,
  lng REAL,
  jurisdiction TEXT,
  parent_id INTEGER REFERENCES judicial_entities(id),
  opening_hours TEXT,
  notes TEXT,
  source_id INTEGER REFERENCES legal_sources(id),
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  last_verified_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS chambers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  court_id INTEGER NOT NULL REFERENCES judicial_entities(id),
  name_ar TEXT,
  name_fr TEXT,
  kind TEXT,
  notes TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS practice_areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  parent_id INTEGER REFERENCES practice_areas(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS case_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  color TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  sort INTEGER DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_type TEXT NOT NULL DEFAULT 'individual',
  full_name_ar TEXT,
  full_name_fr TEXT,
  legal_name TEXT,
  commercial_name TEXT,
  legal_form TEXT,
  rc TEXT,
  nif TEXT,
  nis TEXT,
  identifiers_note TEXT,
  date_of_birth TEXT,
  place_of_birth TEXT,
  nationality TEXT,
  id_number TEXT,
  address TEXT,
  wilaya_id INTEGER REFERENCES wilayas(id),
  municipality TEXT,
  phone TEXT,
  alt_phone TEXT,
  email TEXT,
  profession TEXT,
  employer TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  tags TEXT,
  search_norm TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS client_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  related_name TEXT NOT NULL,
  related_type TEXT DEFAULT 'person',
  relationship TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_type TEXT DEFAULT 'person',
  name_ar TEXT,
  name_fr TEXT,
  organization TEXT,
  job_title TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  wilaya_id INTEGER REFERENCES wilayas(id),
  notes TEXT,
  tags TEXT,
  search_norm TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE,
  internal_number TEXT,
  court_file_number TEXT,
  title_ar TEXT,
  title_fr TEXT,
  client_id INTEGER REFERENCES clients(id),
  opposing_party TEXT,
  opposing_lawyer TEXT,
  court_id INTEGER REFERENCES judicial_entities(id),
  chamber_id INTEGER REFERENCES chambers(id),
  practice_area_id INTEGER REFERENCES practice_areas(id),
  case_type TEXT,
  judge TEXT,
  jurisdiction TEXT,
  status_id INTEGER REFERENCES case_statuses(id),
  priority TEXT NOT NULL DEFAULT 'medium',
  opening_date TEXT,
  closing_date TEXT,
  responsible_lawyer_id INTEGER REFERENCES users(id),
  assistant_id INTEGER REFERENCES users(id),
  next_action TEXT,
  last_action_at TEXT,
  notes TEXT,
  search_norm TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS case_lawyers (
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'team',
  PRIMARY KEY (case_id, user_id)
);

CREATE TABLE IF NOT EXISTS case_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_date TEXT NOT NULL,
  event_time TEXT,
  user_id INTEGER,
  event_type TEXT NOT NULL DEFAULT 'note',
  description TEXT,
  document_id INTEGER,
  task_id INTEGER,
  hearing_id INTEGER,
  deadline_id INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS hearings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER REFERENCES cases(id),
  court_id INTEGER REFERENCES judicial_entities(id),
  chamber_id INTEGER REFERENCES chambers(id),
  date TEXT NOT NULL,
  time TEXT,
  hearing_type TEXT DEFAULT 'civil',
  lawyer_id INTEGER REFERENCES users(id),
  assistant_id INTEGER REFERENCES users(id),
  room TEXT,
  judge TEXT,
  purpose TEXT,
  required_documents TEXT,
  outcome TEXT,
  adjournment_reason TEXT,
  next_date TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS deadline_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  description TEXT,
  amount INTEGER,
  unit TEXT NOT NULL DEFAULT 'day',
  day_type TEXT NOT NULL DEFAULT 'calendar',
  direction TEXT NOT NULL DEFAULT 'forward',
  holiday_exclusion INTEGER NOT NULL DEFAULT 0,
  legal_basis TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  source_id INTEGER REFERENCES legal_sources(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'public',
  court_id INTEGER REFERENCES judicial_entities(id),
  is_recurring_annual INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  source_id INTEGER REFERENCES legal_sources(id),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER REFERENCES cases(id),
  title_ar TEXT,
  title_fr TEXT,
  deadline_type TEXT,
  start_date TEXT,
  rule_id INTEGER REFERENCES deadline_rules(id),
  amount INTEGER,
  unit TEXT DEFAULT 'day',
  day_type TEXT DEFAULT 'calendar',
  holiday_exclusion INTEGER DEFAULT 0,
  direction TEXT DEFAULT 'forward',
  end_date TEXT,
  is_computed INTEGER NOT NULL DEFAULT 0,
  responsible_lawyer_id INTEGER REFERENCES users(id),
  priority TEXT NOT NULL DEFAULT 'medium',
  source TEXT,
  legal_basis TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  status TEXT NOT NULL DEFAULT 'active',
  suspended_until TEXT,
  extended_until TEXT,
  completed_at TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  case_id INTEGER REFERENCES cases(id),
  assigned_to INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  due_date TEXT,
  due_time TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'todo',
  related_hearing_id INTEGER REFERENCES hearings(id),
  related_deadline_id INTEGER REFERENCES deadlines(id),
  completed_at TEXT,
  search_norm TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'appointment',
  start_at TEXT,
  end_at TEXT,
  location TEXT,
  court_id INTEGER REFERENCES judicial_entities(id),
  case_id INTEGER REFERENCES cases(id),
  client_id INTEGER REFERENCES clients(id),
  participants TEXT,
  notes TEXT,
  search_norm TEXT,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'other',
  client_id INTEGER REFERENCES clients(id),
  case_id INTEGER REFERENCES cases(id),
  hearing_id INTEGER REFERENCES hearings(id),
  task_id INTEGER REFERENCES tasks(id),
  invoice_id INTEGER,
  owner_user_id INTEGER REFERENCES users(id),
  court_id INTEGER REFERENCES judicial_entities(id),
  file_path TEXT,
  original_name TEXT,
  mime_type TEXT,
  size INTEGER,
  parent_id INTEGER REFERENCES documents(id),
  version INTEGER NOT NULL DEFAULT 1,
  tags TEXT,
  ocr_text TEXT,
  notes TEXT,
  expires_at TEXT,
  search_norm TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT,
  name_fr TEXT,
  category TEXT DEFAULT 'letter',
  language TEXT NOT NULL DEFAULT 'fr',
  body TEXT,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS legal_texts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'law',
  title_ar TEXT,
  title_fr TEXT,
  number TEXT,
  date TEXT,
  publication_date TEXT,
  oj_number TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'in_force',
  effective_date TEXT,
  repeal_date TEXT,
  source_id INTEGER REFERENCES legal_sources(id),
  source_url TEXT,
  pdf_document_id INTEGER REFERENCES documents(id),
  tags TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  last_verified_at TEXT,
  notes TEXT,
  search_norm TEXT,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS legal_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_id INTEGER NOT NULL REFERENCES legal_texts(id) ON DELETE CASCADE,
  article_number TEXT NOT NULL,
  title_ar TEXT,
  title_fr TEXT,
  body_ar TEXT,
  body_fr TEXT,
  status TEXT NOT NULL DEFAULT 'in_force',
  modified_by TEXT,
  modification_date TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  effective_date TEXT,
  source_id INTEGER REFERENCES legal_sources(id),
  source_url TEXT,
  oj_number TEXT,
  tags TEXT,
  notes TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  search_norm TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS legal_article_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES legal_articles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body_ar TEXT,
  body_fr TEXT,
  effective_date TEXT,
  modified_by TEXT,
  change_note TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS jurisprudence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  court_id INTEGER REFERENCES judicial_entities(id),
  chamber TEXT,
  decision_number TEXT,
  decision_date TEXT,
  case_number TEXT,
  subject TEXT,
  keywords TEXT,
  principle_ar TEXT,
  principle_fr TEXT,
  summary_ar TEXT,
  summary_fr TEXT,
  full_text_ar TEXT,
  full_text_fr TEXT,
  source_id INTEGER REFERENCES legal_sources(id),
  source_url TEXT,
  pdf_document_id INTEGER REFERENCES documents(id),
  related_article_ids TEXT,
  related_case_ids TEXT,
  notes TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  search_norm TEXT,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS jurisprudence_bookmarks (
  user_id INTEGER NOT NULL REFERENCES users(id),
  decision_id INTEGER NOT NULL REFERENCES jurisprudence(id) ON DELETE CASCADE,
  created_at TEXT,
  PRIMARY KEY (user_id, decision_id)
);

CREATE TABLE IF NOT EXISTS jurisprudence_views (
  user_id INTEGER NOT NULL REFERENCES users(id),
  decision_id INTEGER NOT NULL REFERENCES jurisprudence(id) ON DELETE CASCADE,
  viewed_at TEXT,
  PRIMARY KEY (user_id, decision_id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE,
  client_id INTEGER REFERENCES clients(id),
  case_id INTEGER REFERENCES cases(id),
  issue_date TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'DZD',
  notes TEXT,
  search_norm TEXT,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT,
  description_ar TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  date TEXT,
  method TEXT,
  reference TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER REFERENCES cases(id),
  client_id INTEGER REFERENCES clients(id),
  category TEXT,
  description TEXT,
  amount REAL NOT NULL DEFAULT 0,
  date TEXT,
  user_id INTEGER REFERENCES users(id),
  receipt_document_id INTEGER REFERENCES documents(id),
  reimbursable INTEGER NOT NULL DEFAULT 0,
  billed INTEGER NOT NULL DEFAULT 0,
  search_norm TEXT,
  created_by INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  kind TEXT,
  title_ar TEXT,
  title_fr TEXT,
  body_ar TEXT,
  body_fr TEXT,
  ref_type TEXT,
  ref_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS data_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_ref TEXT,
  field TEXT NOT NULL,
  value_a TEXT,
  value_b TEXT,
  source_a TEXT,
  source_b TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  notes TEXT,
  created_at TEXT,
  resolved_at TEXT,
  resolved_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_court ON cases(court_id);
CREATE INDEX IF NOT EXISTS idx_hearings_date ON hearings(date);
CREATE INDEX IF NOT EXISTS idx_deadlines_end ON deadlines(end_date);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_docs_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at);
`;

db.exec(SCHEMA);

const now = () => new Date().toISOString();

function resetSchema() {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);
  db.exec('PRAGMA foreign_keys = OFF');
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t}"`);
  db.exec(SCHEMA);
  db.exec('PRAGMA foreign_keys = ON');
}

module.exports = { db, now, DATA_DIR, UPLOADS_DIR, SCHEMA, resetSchema, DRIVER };
