-- Esquema do FinPulse. Pode ser executado mais de uma vez (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    VARCHAR(40) NOT NULL,
  type    VARCHAR(7)  NOT NULL CHECK (type IN ('income', 'expense')),
  color   CHAR(7)     NOT NULL DEFAULT '#0E7C86',
  UNIQUE (user_id, name, type)
);

CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- RESTRICT: não deixa apagar uma categoria que ainda tem lançamentos
  category_id INTEGER        NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description VARCHAR(120)   NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type        VARCHAR(7)     NOT NULL CHECK (type IN ('income', 'expense')),
  date        DATE           NOT NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC);

CREATE TABLE IF NOT EXISTS budgets (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  INTEGER        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month        CHAR(7)        NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  limit_amount NUMERIC(12, 2) NOT NULL CHECK (limit_amount > 0),
  UNIQUE (user_id, category_id, month)
);

-- Carteira: o que o usuário possui de cada ativo.
-- kind = 'crypto'   -> code é o id da moeda no CoinGecko (ex.: bitcoin)
-- kind = 'currency' -> code é o código ISO da moeda (ex.: USD)
CREATE TABLE IF NOT EXISTS assets (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         VARCHAR(8)      NOT NULL CHECK (kind IN ('crypto', 'currency')),
  code         VARCHAR(60)     NOT NULL,
  symbol       VARCHAR(12)     NOT NULL,
  name         VARCHAR(60)     NOT NULL,
  quantity     NUMERIC(24, 8)  NOT NULL CHECK (quantity > 0),
  -- total em reais que o usuário pagou por essa posição (opcional, serve para lucro/prejuízo)
  invested_brl NUMERIC(14, 2)  CHECK (invested_brl IS NULL OR invested_brl >= 0),
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, code)
);
