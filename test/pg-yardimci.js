// Testler için geçici PostgreSQL veritabanı: her çalıştırmada yeni bir veritabanı açılır, sonunda silinir.
// Yönetici bağlantısı: TEST_DATABASE_URL (varsayılan: postgres://localhost:5432/postgres)
const { Client } = require('pg');
const crypto = require('crypto');

const YONETICI = process.env.TEST_DATABASE_URL || 'postgres://localhost:5432/postgres';

async function geciciVeritabani() {
  const ad = 'kok_test_' + crypto.randomBytes(5).toString('hex');
  const y = new Client({ connectionString: YONETICI }); await y.connect();
  try { await y.query('CREATE DATABASE ' + ad); } finally { await y.end(); }
  const u = new URL(YONETICI); u.pathname = '/' + ad;
  return {
    ad, url: u.toString(),
    async sil() {
      const z = new Client({ connectionString: YONETICI }); await z.connect();
      try { await z.query('DROP DATABASE IF EXISTS ' + ad + ' WITH (FORCE)'); } finally { await z.end(); }
    },
  };
}
module.exports = { geciciVeritabani };
