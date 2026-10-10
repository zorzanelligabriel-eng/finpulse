const express = require('express');
const db = require('../db/pool');
const { z, month, currentMonth, monthRange } = require('../utils/schemas');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/httpError');
const { listBudgets } = require('./budgets');

const router = express.Router();

const MONTHS_IN_HISTORY = 6;

// Lista os N meses que terminam em `monthValue`, do mais antigo ao mais recente.
function lastMonths(monthValue, count) {
  const [year, monthNumber] = monthValue.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(Date.UTC(year, monthNumber - 1 - (count - 1 - index), 1));
    return d.toISOString().slice(0, 7);
  });
}

router.get(
  '/',
  validate(z.object({ month: month.optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const monthValue = req.valid.query.month || currentMonth();
    const { start, end } = monthRange(monthValue);
    const months = lastMonths(monthValue, MONTHS_IN_HISTORY);

    const [summary, byCategory, history, budgets] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::float8 AS income,
                COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::float8 AS expense
           FROM transactions WHERE user_id = $1 AND date >= $2 AND date < $3`,
        [req.userId, start, end]
      ),
      db.query(
        `SELECT c.id AS "categoryId", c.name, c.color, SUM(t.amount)::float8 AS total
           FROM transactions t JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = $1 AND t.type = 'expense' AND t.date >= $2 AND t.date < $3
          GROUP BY c.id ORDER BY total DESC`,
        [req.userId, start, end]
      ),
      db.query(
        `SELECT to_char(date, 'YYYY-MM') AS month,
                COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::float8 AS income,
                COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::float8 AS expense
           FROM transactions WHERE user_id = $1 AND date >= $2 AND date < $3
          GROUP BY 1`,
        [req.userId, `${months[0]}-01`, end]
      ),
      listBudgets(req.userId, monthValue),
    ]);

    const { income, expense } = summary.rows[0];
    // Meses sem lançamento não voltam do banco; preenche com zero para o gráfico não ter buracos.
    const historyByMonth = new Map(history.rows.map((row) => [row.month, row]));

    res.json({
      month: monthValue,
      income,
      expense,
      balance: Math.round((income - expense) * 100) / 100,
      byCategory: byCategory.rows,
      history: months.map((m) => ({
        month: m,
        income: historyByMonth.get(m)?.income ?? 0,
        expense: historyByMonth.get(m)?.expense ?? 0,
      })),
      budgetAlerts: budgets.filter((budget) => budget.status !== 'ok'),
    });
  })
);

module.exports = router;
module.exports.lastMonths = lastMonths;
