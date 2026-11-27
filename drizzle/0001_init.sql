-- Сэтгэлийн Одод — анхны шилжилт (0001_init).
-- Хэрэглээ: npm run db:migrate (DATABASE_URL орчноос уншина).

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  username VARCHAR(30) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(200) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tests (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category VARCHAR(100) NOT NULL DEFAULT 'Ерөнхий',
  price_mnt INTEGER NOT NULL DEFAULT 6500,
  published BOOLEAN NOT NULL DEFAULT true,
  scoring JSONB NOT NULL,
  source_file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  test_id INTEGER NOT NULL REFERENCES tests (id),
  amount_mnt INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  qpay_invoice_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS purchases_user_test_unique ON purchases (user_id, test_id);

CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  test_id INTEGER NOT NULL REFERENCES tests (id),
  answers JSONB NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  result_title TEXT NOT NULL,
  result_description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qpay_settings (
  id INTEGER PRIMARY KEY,
  client_id TEXT NOT NULL DEFAULT '',
  client_secret TEXT NOT NULL DEFAULT '',
  invoice_code TEXT NOT NULL DEFAULT '',
  merchant_id TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
