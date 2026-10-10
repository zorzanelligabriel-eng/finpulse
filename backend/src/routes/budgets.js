const express = require('express');
const db = require('../db/pool');
const { z, id, month, money, idParam, currentMonth, monthRange } = require('../utils/schemas');
const { validate } = require('../middleware/validate');
const { HttpError, asyncHandler } = require('../utils/httpError');

const router = express.Router();

const listSchema = z.object({ month: month.optional() });
const budgetSchema = z.object({ categoryId: id, month, limit: money });

// Classifica o orçamento conforme o quanto já foi gasto.
function budgetStatus(spent, limit) {
  const ratio = spent / limit;
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'warning';
  return 'ok';
}

async function listBudgets(userId, monthValue) {
  const { start, end } = monthRange(monthValue);
  const result = await db.query(
    `SELECT b.id, b.month, b.limit_amount::float8 AS "limit",
            c.id AS "categoryId", c.name AS "categoryName", c.color AS "categoryColor",
            COALESCE(SUM(t.amount), 0)::float8 AS spent
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       LEFT JOIN transactions t
              ON t.category_id = b.category_id AND t.user_id = b.user_id
             AND t.date >= $3 AND t.date < $4
      WHERE b.user_id = $1 AND b.month = $2
      GROUP BY b.id, c.id
      ORDER BY c.name`,
    [userId, monthValue, start, end]
  );
  return result.rows.map((row) => ({
    ...row,
    remaining: Math.round((row.limit - row.spent) * 100) / 100,
    percent: Math.round((row.spent / row.limit) * 100),
    status: budgetStatus(row.spent, row.limit),
  }));
}

router.get(
  '/',
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json(await listBudgets(req.userId, req.valid.query.month || currentMonth()));
  })
);

// Cria ou atualiza o limite da categoria naquele mês (um orçamento por categoria/mês).
router.put(
  '/',
  validate(budgetSchema),
  asyncHandler(async (req, res) => {
    const { categoryId, month: monthValue, limit } = req.valid.body;
    const category = await db.query('SELECT type FROM categories WHERE id = $1 AND user_id = $2', [categoryId, req.userId]);
    if (!category.rows.length) throw new HttpError(400, 'Categoria não encontrada.');
    if (category.rows[0].type !== 'expense') {
      throw new HttpError(400, 'Orçamentos só valem para categorias de despesa.');
    }
    await db.query(
      `INSERT INTO budgets (user_id, category_id, month, limit_amount) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, category_id, month) DO UPDATE SET limit_amount = EXCLUDED.limit_amount`,
      [req.userId, categoryId, monthValue, limit]
    );
    const budgets = await listBudgets(req.userId, monthValue);
    res.json(budgets.find((budget) => budget.categoryId === categoryId));
  })
);

router.delete(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const deleted = await db.query('DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.valid.params.id,
      req.userId,
    ]);
    if (!deleted.rows.length) throw new HttpError(404, 'Orçamento não encontrado.');
    res.status(204).end();
  })
);

module.exports = router;
module.exports.listBudgets = listBudgets;
module.exports.budgetStatus = budgetStatus;
