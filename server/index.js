/**
 * ADVOCATE PRO ALGÉRIE — Express server.
 * Serves the REST API (/api) and, in production, the built frontend (dist/).
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

const { db } = require('./db');

const app = express();
const PORT = process.env.PORT || 8787;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------ routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/directory', require('./routes/directory'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/legal', require('./routes/legal'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/insights', require('./routes/insights'));

// auto-seed reference data when DB is fresh (first boot)
try {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
    console.log('📄 Empty database detected — running seeder…');
    require('child_process').execSync('node server/seed/index.js --run', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  }
} catch (e) {
  console.warn('Auto-seed skipped:', e.message);
}

// ------------------------------------------------ static frontend
if (isProd) {
  const dist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
}

app.use((err, req, res, next) => {
  if (err && err.message === 'file_type_not_allowed') {
    return res.status(400).json({ ok: false, error: 'file_type_not_allowed' });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ ok: false, error: 'file_too_large' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'internal_error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚖️  ADVOCATE PRO ALGÉRIE — server ready on http://0.0.0.0:${PORT}`);
  console.log(`   API: /api — production static: ${isProd ? 'enabled' : 'disabled (dev mode)'}`);
});
