const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({ connectionString: config.databaseUrl });

// Atalho usado pelas rotas: sempre com parâmetros ($1, $2...) para evitar SQL injection.
function query(text, params) {
  return pool.query(text, params);
}

// Executa várias queries na mesma transação: ou todas valem, ou nenhuma.
async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
