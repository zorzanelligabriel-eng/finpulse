const express = require('express');
const db = require('../db/pool');
const { z, id, date, money, type, idParam } = require('../utils/schemas');
const { validate } = require('../middleware/validate');
const { HttpError, asyncHandler } = require('../utils/httpError');

const router = express.Router();

const transactionSchema = z.object({
  description: z.string({ required_error: 'Informe uma descrição.' }).trim().min(1, 'Informe uma descrição.').max(120),
  amount: money,
  date,
  categoryId: id,
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  type: type.optional(),
  categoryId: id.optional(),
  from: date.optional(),
  to: date.optional(),
  q: z.string().trim().max(60).optional(),
});

const SELECT_TRANSACTION = `
  SELECT t.id, t.description, t.amount::float8 AS amount, t.type,
         to_char(t.date, 'YYYY-MM-DD') AS date,
         c.id AS "categoryId", c.name AS "categoryName", c.color AS "categoryColor"
    FROM transactions t
    JOIN categories c ON c.id = t.category_id`;

router.get(
  '/',
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, type: filterType, categoryId, from, to, q } = req.valid.query;

    // Monta o WHERE só com os filtros que vieram, sempre usando parâmetros.
    const conditions = ['t.user_id = $1'];
    const params = [req.userId];
    const add = (sql, value) => {
      params.push(value);
      conditions.push(sql.replace('?', `$${params.length}`));
    };
    if (filterType) add('t.type = ?', filterType);
    if (categoryId) add('t.category_id = ?', categoryId);
    if (from) add('t.date >= ?', from);
    if (to) add('t.date <= ?', to);
    if (q) add("t.description ILIKE '%' || ? || '%'", q);
    const where = conditions.join(' AND ');

    const totals = await db.query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::float8 AS income,
              COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::float8 AS expense
         FROM transactions t WHERE ${where}`,
      params
    );
    const { total, income, expense } = totals.rows[0];

    const rows = await db.query(
      `${SELECT_TRANSACTION} WHERE ${where}
        ORDER BY t.date DESC, t.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    );

    res.json({
      data: rows.rows,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      // somas de tudo que bate com o filtro, não só da página atual
      totals: { income, expense, balance: Math.round((income - expense) * 100) / 100 },
    });
  })
);

router.post(
  '/',
  validate(transactionSchema),
  asyncHandler(async (req, res) => {
    const { description, amount, date: when, categoryId } = req.valid.body;
    const category = await findCategory(req.userId, categoryId);
    const inserted = await db.query(
      `INSERT INTO transactions (user_id, category_id, description, amount, type, date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.userId, categoryId, description, amount, category.type, when]
    );
    res.status(201).json(await findTransaction(req.userId, inserted.rows[0].id));
  })
);

router.put(
  '/:id',
  validate(idParam, 'params'),
  validate(transactionSchema),
  asyncHandler(async (req, res) => {
    const { description, amount, date: when, categoryId } = req.valid.body;
    const category = await findCategory(req.userId, categoryId);
    const updated = await db.query(
      `UPDATE transactions
          SET description = $1, amount = $2, date = $3, category_id = $4, type = $5
        WHERE id = $6 AND user_id = $7 RETURNING id`,
      [description, amount, when, categoryId, category.type, req.valid.params.id, req.userId]
    );
    if (!updated.rows.length) throw new HttpError(404, 'Lançamento não encontrado.');
    res.json(await findTransaction(req.userId, updated.rows[0].id));
  })
);

router.delete(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const deleted = await db.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.valid.params.id,
      req.userId,
    ]);
    if (!deleted.rows.length) throw new HttpError(404, 'Lançamento não encontrado.');
    res.status(204).end();
  })
);

// O tipo do lançamento (receita/despesa) vem sempre da categoria escolhida.
async function findCategory(userId, categoryId) {
  const result = await db.query('SELECT id, type FROM categories WHERE id = $1 AND user_id = $2', [categoryId, userId]);
  if (!result.rows.length) throw new HttpError(400, 'Categoria não encontrada.');
  return result.rows[0];
}

async function findTransaction(userId, transactionId) {
  const result = await db.query(`${SELECT_TRANSACTION} WHERE t.id = $1 AND t.user_id = $2`, [transactionId, userId]);
  return result.rows[0];
}

module.exports = router;
