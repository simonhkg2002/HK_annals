import 'dotenv/config';
import { createClient } from '@libsql/client';
const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
async function check() {
  const result = await db.execute(`
    SELECT a.id, a.original_id, a.title, ms.code
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    WHERE ms.code = 'mingpao'
    ORDER BY a.published_at DESC
    LIMIT 10
  `);
  console.log('Ming Pao articles:', result.rows.length);
  result.rows.forEach(r => console.log(r.original_id, '-', String(r.title).substring(0, 40)));

  // Check Ming Pao media source ID
  const source = await db.execute("SELECT id, code, name_zh FROM media_sources WHERE code = 'mingpao'");
  console.log('\nMing Pao source:', source.rows[0]);
}
check();
