// Сэтгэлийн Одод — шилжилт (migration) ажиллуулах скрипт.
// Хэрэглээ: npm run db:migrate
// DATABASE_URL орчноос уншина — dotenv байхгүй тул .env-ийг shell-ээр ачаална уу:
//   set -a; source .env; set +a; npm run db:migrate
// Эсвэл: DATABASE_URL=postgres://... npm run db:migrate
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'drizzle');

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      'Алдаа: DATABASE_URL орчны хувьсагч тохируулагдаагүй байна. ' +
        'Эхлээд "set -a; source .env; set +a" гэж ачаалаад дахин ажиллуулна уу.',
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS _migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );

    const applied = await pool.query<{ filename: string }>('SELECT filename FROM _migrations');
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    if (files.length === 0) {
      console.log('Шилжилтийн файл олдсонгүй.');
    }
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`Алгасав (аль хэдийн хэрэгжсэн): ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Хэрэгжлээ: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    console.log('Шилжилт дууслаа.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Шилжилт амжилтгүй боллоо:', err instanceof Error ? err.message : err);
  process.exit(1);
});
