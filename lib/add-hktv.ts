import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function addHKTV() {
  await db.execute(`
    INSERT OR IGNORE INTO media_sources (code, name_zh, name_en, website_url, language)
    VALUES ('hktv', '香港開電視', 'HKTV', 'https://www.hkopentv.com', 'zh')
  `);
  console.log('✅ Added HKTV to media_sources');

  const sources = await db.execute('SELECT code, name_zh FROM media_sources');
  console.log('\n📺 All media sources:');
  sources.rows.forEach(r => console.log('  -', r.code, ':', r.name_zh));
}
addHKTV();
