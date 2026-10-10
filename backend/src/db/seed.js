// Cria uma conta de demonstração com dados fictícios: npm run seed
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('./pool');
const { migrate } = require('./migrate');

const DEMO = { name: 'Conta Demo', email: 'demo@finpulse.dev', password: 'demo1234' };

const CATEGORIES = [
  ['Salário', 'income', '#1F8A4C'],
  ['Renda extra', 'income', '#0E7C86'],
  ['Moradia', 'expense', '#2B6CB0'],
  ['Alimentação', 'expense', '#C2362F'],
  ['Transporte', 'expense', '#B5651D'],
  ['Lazer', 'expense', '#6E4FA3'],
  ['Saúde', 'expense', '#D1478A'],
  ['Estudos', 'expense', '#E0A82E'],
];

// [dia do mês, descrição, categoria, valor] repetidos em cada mês, com pequena variação
const MONTHLY = [
  [1, 'Salário', 'Salário', 3200],
  [2, 'Aluguel', 'Moradia', 950],
  [3, 'Mercado do mês', 'Alimentação', 520],
  [4, 'Passe de ônibus', 'Transporte', 180],
  [5, 'Conta de luz', 'Moradia', 142],
  [6, 'Mensalidade do curso', 'Estudos', 310],
  [7, 'Cinema e lanche', 'Lazer', 74],
  [8, 'Internet', 'Moradia', 99.9],
  [9, 'Farmácia', 'Saúde', 58.4],
  [12, 'Freela de site', 'Renda extra', 450],
  [15, 'Padaria e feira', 'Alimentação', 130],
  [18, 'Aplicativo de transporte', 'Transporte', 46],
  [22, 'Assinatura de streaming', 'Lazer', 39.9],
  [26, 'Restaurante', 'Alimentação', 96],
];

const BUDGETS = { Alimentação: 700, Transporte: 250, Lazer: 150, Moradia: 1200 };

const ASSETS = [
  ['crypto', 'bitcoin', 'BTC', 'Bitcoin', 0.0125, 6800],
  ['crypto', 'ethereum', 'ETH', 'Ethereum', 0.4, 7900],
  ['crypto', 'solana', 'SOL', 'Solana', 3, 2700],
  ['currency', 'USD', 'USD', 'Dólar americano', 350, 1820],
  ['currency', 'EUR', 'EUR', 'Euro', 120, 730],
];

const pad = (n) => String(n).padStart(2, '0');

async function seed() {
  await migrate();
  const passwordHash = await bcrypt.hash(DEMO.password, 10);

  await withTransaction(async (client) => {
    // apagar o usuário apaga tudo dele (ON DELETE CASCADE), então o seed pode rodar várias vezes
    await client.query('DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [DEMO.email]);
    await client.query('DELETE FROM users WHERE email = $1', [DEMO.email]);

    const user = await client.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id', [
      DEMO.name,
      DEMO.email,
      passwordHash,
    ]);
    const userId = user.rows[0].id;

    const categoryIds = {};
    for (const [name, type, color] of CATEGORIES) {
      const created = await client.query(
        'INSERT INTO categories (user_id, name, type, color) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, name, type, color]
      );
      categoryIds[name] = { id: created.rows[0].id, type };
    }

    // datas no horário local, para o seed não criar lançamentos "de amanhã" à noite
    const today = new Date();
    // mês atual e os 5 anteriores
    for (let back = 5; back >= 0; back -= 1) {
      const first = new Date(today.getFullYear(), today.getMonth() - back, 1);
      const month = `${first.getFullYear()}-${pad(first.getMonth() + 1)}`;

      for (const [day, description, categoryName, amount] of MONTHLY) {
        // no mês atual, só o que já "aconteceu"
        if (back === 0 && day > today.getDate()) continue;
        const category = categoryIds[categoryName];
        const variation = category.type === 'expense' ? 1 + ((back * 7 + day) % 9) / 50 : 1;
        await client.query(
          `INSERT INTO transactions (user_id, category_id, description, amount, type, date)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, category.id, description, (amount * variation).toFixed(2), category.type, `${month}-${pad(day)}`]
        );
      }

      if (back === 0) {
        for (const [categoryName, limit] of Object.entries(BUDGETS)) {
          await client.query('INSERT INTO budgets (user_id, category_id, month, limit_amount) VALUES ($1, $2, $3, $4)', [
            userId,
            categoryIds[categoryName].id,
            month,
            limit,
          ]);
        }
      }
    }

    for (const [kind, code, symbol, name, quantity, invested] of ASSETS) {
      await client.query(
        `INSERT INTO assets (user_id, kind, code, symbol, name, quantity, invested_brl)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, kind, code, symbol, name, quantity, invested]
      );
    }
  });

  console.log(`Conta de demonstração criada: ${DEMO.email} / ${DEMO.password}`);
}

seed()
  .catch((err) => {
    console.error('Falha no seed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
