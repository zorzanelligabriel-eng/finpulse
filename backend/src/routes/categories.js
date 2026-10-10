const express = require('express');
const db = require('../db/pool');
const { z, type, idParam } = require('../utils/schemas');
const { validate } = require('../middleware/validate');
const { HttpError, asyncHandler } = require('../utils/httpError');

const router = express.Router();

const categorySchema = z.object({
  name: z.string({ required_error: 'Informe o nome da categoria.' }).trim().min(1, 'Informe o nome da categoria.').max(40),
  type,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida. Use o formato #RRGGBB.')
    .default('#0E7C86'),
});

// O tipo não muda depois de criada: evitaria lançamentos de despesa numa categoria de receita.
const updateSchema = categorySchema.omit({ type: true });

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await db.query(
      `SELECT c.id, c.name, c.type, c.color, COUNT(t.id)::int AS "transactionCount"
         FROM categories c
         LEFT JOIN transactions t ON t.category_id = c.id
        WHERE c.user_id = $1
        GROUP BY c.id
        ORDER BY c.type, c.name`,
      [req.userId]
    );
    res.json(result.rows);
  })
);

router.post(
  '/',
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const { name, type: categoryType, color } = req.valid.body;
    await ensureUniqueName(req.userId, name, categoryType);
    const result = await db.query(
      'INSERT INTO categories (user_id, name, type, color) VALUES ($1, $2, $3, $4) RETURNING id, name, type, color',
      [req.userId, name, categoryType, color]
    );
    res.status(201).json({ ...result.rows[0], transactionCount: 0 });
  })
);

router.put(
  '/:id',
  validate(idParam, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params;
    const { name, color } = req.valid.body;

    const current = await db.query('SELECT type FROM categories WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (!current.rows.length) throw new HttpError(404, 'Categoria não encontrada.');
    await ensureUniqueName(req.userId, name, current.rows[0].type, id);

    const result = await db.query(
      'UPDATE categories SET name = $1, color = $2 WHERE id = $3 AND user_id = $4 RETURNING id, name, type, color',
      [name, color, id, req.userId]
    );
    res.json(result.rows[0]);
  })
);

router.delete(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params;
    const inUse = await db.query('SELECT COUNT(*)::int AS total FROM transactions WHERE category_id = $1 AND user_id = $2', [
      id,
      req.userId,
    ]);
    if (inUse.rows[0].total > 0) {
      throw new HttpError(409, 'Esta categoria tem lançamentos. Mova ou exclua os lançamentos antes de apagá-la.');
    }
    const result = await db.query('DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.userId]);
    if (!result.rows.length) throw new HttpError(404, 'Categoria não encontrada.');
    res.status(204).end();
  })
);

async function ensureUniqueName(userId, name, categoryType, ignoreId = 0) {
  const duplicate = await db.query(
    'SELECT 1 FROM categories WHERE user_id = $1 AND lower(name) = lower($2) AND type = $3 AND id <> $4',
    [userId, name, categoryType, ignoreId]
  );
  if (duplicate.rows.length) throw new HttpError(409, 'Você já tem uma categoria com esse nome.');
}

module.exports = router;
