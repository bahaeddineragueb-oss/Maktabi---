/**
 * ADVOCATE PRO ALGÉRIE — Permission catalog & role defaults.
 * Granular, extensible permission matrix for multi-user law firms.
 */
const PERMISSIONS = [
  'cases.view', 'cases.edit', 'cases.delete',
  'clients.view', 'clients.edit', 'clients.delete',
  'hearings.view', 'hearings.edit',
  'deadlines.view', 'deadlines.edit',
  'tasks.view', 'tasks.edit',
  'calendar.view', 'calendar.edit',
  'documents.view', 'documents.upload', 'documents.delete',
  'legal.view', 'legal.edit',
  'directory.view', 'directory.edit',
  'finance.view', 'finance.edit',
  'contacts.view', 'contacts.edit',
  'conflict.check',
  'reports.view',
  'search.use',
  'staff.view', 'staff.manage',
  'settings.manage',
  'audit.view',
  'backup.manage',
  'export.data'
];

const ROLE_DEFAULTS = {
  super_admin: PERMISSIONS,
  firm_owner: PERMISSIONS,
  lawyer: [
    'cases.view', 'cases.edit',
    'clients.view', 'clients.edit',
    'hearings.view', 'hearings.edit',
    'deadlines.view', 'deadlines.edit',
    'tasks.view', 'tasks.edit',
    'calendar.view', 'calendar.edit',
    'documents.view', 'documents.upload',
    'legal.view', 'directory.view',
    'finance.view', 'contacts.view', 'contacts.edit',
    'conflict.check', 'reports.view', 'search.use', 'export.data', 'staff.view'
  ],
  associate_lawyer: [
    'cases.view', 'cases.edit',
    'clients.view', 'clients.edit',
    'hearings.view', 'hearings.edit',
    'deadlines.view', 'deadlines.edit',
    'tasks.view', 'tasks.edit',
    'calendar.view', 'calendar.edit',
    'documents.view', 'documents.upload',
    'legal.view', 'directory.view',
    'contacts.view', 'conflict.check', 'reports.view', 'search.use', 'staff.view'
  ],
  legal_assistant: [
    'cases.view', 'cases.edit',
    'clients.view', 'clients.edit',
    'hearings.view', 'hearings.edit',
    'deadlines.view',
    'tasks.view', 'tasks.edit',
    'calendar.view', 'calendar.edit',
    'documents.view', 'documents.upload',
    'legal.view', 'directory.view',
    'contacts.view', 'conflict.check', 'search.use', 'staff.view'
  ],
  secretary: [
    'cases.view', 'cases.edit',
    'clients.view', 'clients.edit',
    'hearings.view', 'hearings.edit',
    'deadlines.view',
    'tasks.view', 'tasks.edit',
    'calendar.view', 'calendar.edit',
    'documents.view', 'documents.upload',
    'directory.view', 'contacts.view', 'contacts.edit', 'search.use', 'staff.view'
  ],
  accountant: [
    'cases.view', 'clients.view',
    'finance.view', 'finance.edit',
    'documents.view', 'contacts.view',
    'reports.view', 'search.use', 'staff.view', 'export.data'
  ],
  read_only: [
    'cases.view', 'clients.view', 'hearings.view', 'deadlines.view',
    'tasks.view', 'calendar.view', 'documents.view', 'legal.view',
    'directory.view', 'finance.view', 'contacts.view', 'reports.view', 'search.use', 'staff.view'
  ]
};

const ROLES = Object.keys(ROLE_DEFAULTS);

module.exports = { PERMISSIONS, ROLE_DEFAULTS, ROLES };
