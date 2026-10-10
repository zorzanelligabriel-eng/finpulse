const express = require('express');
const db = require('../db/pool');
const { z, idParam } = require('../utils/schemas');
const { validate } = require('../middleware/validate');
const { HttpError, asyncHandler } = require('../utils/httpError');
const { findQuote } = require('../services/marketService');
const { valuatePortfolio } = require('../services/portfolio');

const quantity = z.coerce
  .number({ invalid_type_error: 'Informe a quantidade.' })
  .positive('A quantidade deve ser maior que zero.')
  .max(1e15, 'Quantidade alta demais.');

const invested = z.coerce
  .number({ invalid_type_error: 'Valor investido inválido.' })
  .min(0, 'O valor investido não pode ser negativo.')
  .max(99_999_999_999.99, 'Valor alto demais.')
  .nullish()
  .transform((value) => (value == null ? null : Math.round(value * 100) / 100));

const createSchema = z.object({
  kind: z.enum(['crypto', 'currency'], { errorMap: () => ({ message: 'Tipo de ativo inválido.' }) }),
  code: z.string({ required_error: 'Escolha um ativo.' }).trim().min(1, 'Escolha um ativo.').max(60),
  quantity,
  investedBrl: invested,
});

const updateSchema = z.object({ quantity, investedBrl: invested });

const SELECT_ASSET = `
  SELECT id, kind, code, symbol, name, quantity::float8 AS quantity, invested_brl::float8 AS "investedBrl"
    FROM assets`;

// `market` é o MarketService: vem por parâmetro para os testes poderem trocar por um falso.
function createAssetsRouter(market) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const result = await db.query(`${SELECT_ASSET} WHERE user_id = $1 ORDER BY kind, name`, [req.userId]);
      const snapshot = market.getSnapshot();
      res.json({ ...valuatePortfolio(result.rows, snapshot), updatedAt: snapshot.updatedAt, status: snapshot.status });
    })
  );

  router.post(
    '/',
    validate(createSchema),
    asyncHandler(async (req, res) => {
      const { kind, quantity: amount, investedBrl } = req.valid.body;
      // id de cripto é minúsculo (bitcoin); código de moeda é maiúsculo (USD)
      const code = kind === 'crypto' ? req.valid.body.code.toLowerCase() : req.valid.body.code.toUpperCase();

      const quote = findQuote(market.getSnapshot(), kind, code);
      if (!quote) throw new HttpError(400, 'Este ativo não está na lista de cotações acompanhadas.');

      const duplicate = await db.query('SELECT 1 FROM assets WHERE user_id = $1 AND kind = $2 AND code = $3', [
        req.userId,
        kind,
        code,
      ]);
      if (duplicate.rows.length) {
        throw new HttpError(409, `${quote.name} já está na sua carteira. Edite a quantidade em vez de adicionar de novo.`);
      }

      const inserted = await db.query(
        `INSERT INTO assets (user_id, kind, code, symbol, name, quantity, invested_brl)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [req.userId, kind, code, quote.symbol, quote.name, amount, investedBrl]
      );
      const created = await db.query(`${SELECT_ASSET} WHERE id = $1`, [inserted.rows[0].id]);
      res.status(201).json(created.rows[0]);
    })
  );

  router.put(
    '/:id',
    validate(idParam, 'params'),
    validate(updateSchema),
    asyncHandler(async (req, res) => {
      const { quantity: amount, investedBrl } = req.valid.body;
      const updated = await db.query(
        'UPDATE assets SET quantity = $1, invested_brl = $2 WHERE id = $3 AND user_id = $4 RETURNING id',
        [amount, investedBrl, req.valid.params.id, req.userId]
      );
      if (!updated.rows.length) throw new HttpError(404, 'Ativo não encontrado.');
      const found = await db.query(`${SELECT_ASSET} WHERE id = $1`, [updated.rows[0].id]);
      res.json(found.rows[0]);
    })
  );

  router.delete(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
      const deleted = await db.query('DELETE FROM assets WHERE id = $1 AND user_id = $2 RETURNING id', [
        req.valid.params.id,
        req.userId,
      ]);
      if (!deleted.rows.length) throw new HttpError(404, 'Ativo não encontrado.');
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createAssetsRouter };
