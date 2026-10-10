const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

// Permite rodar direto: npm run migrate
if (require.main === module) {
  migrate()
    .then(() => console.log('Tabelas criadas/atualizadas.'))
    .catch((err) => {
      console.error('Falha ao criar as tabelas:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { migrate };
