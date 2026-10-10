const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { z } = require('../utils/schemas');
const { validate } = require('../middleware/validate');
const { signToken, requireAuth } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/httpError');

const router = express.Router();

const registerSchema = z.object({
  name: z.string({ required_error: 'Informe seu nome.' }).trim().min(2, 'Informe seu nome.').max(80),
  email: z.string({ required_error: 'Informe seu e-mail.' }).trim().toLowerCase().email('E-mail inválido.').max(160),
  password: z
    .string({ required_error: 'Informe uma senha.' })
    .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
    .max(72, 'A senha pode ter no máximo 72 caracteres.'),
});

const loginSchema = z.object({
  email: z.string({ required_error: 'Informe seu e-mail.' }).trim().toLowerCase(),
  password: z.string({ required_error: 'Informe sua senha.' }),
});

// Categorias criadas automaticamente para todo usuário novo.
const DEFAULT_CATEGORIES = [
  ['Salário', 'income', '#1F8A4C'],
  ['Renda extra', 'income', '#0E7C86'],
  ['Moradia', 'expense', '#2B6CB0'],
  ['Alimentação', 'expense', '#C2362F'],
  ['Transporte', 'expense', '#B5651D'],
  ['Lazer', 'expense', '#6E4FA3'],
  ['Saúde', 'expense', '#D1478A'],
  ['Estudos', 'expense', '#E0A82E'],
];

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.valid.body;

    const existing = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rows.length) throw new HttpError(409, 'Já existe uma conta com este e-mail.');

    const passwordHash = await bcrypt.hash(password, 10);

    // Usuário e categorias padrão entram juntos: se algo falhar, nada é gravado.
    const user = await db.withTransaction(async (client) => {
      const inserted = await client.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
        [name, email, passwordHash]
      );
      const created = inserted.rows[0];
      for (const [categoryName, type, color] of DEFAULT_CATEGORIES) {
        await client.query('INSERT INTO categories (user_id, name, type, color) VALUES ($1, $2, $3, $4)', [
          created.id,
          categoryName,
          type,
          color,
        ]);
      }
      return created;
    });

    res.status(201).json({ user, token: signToken(user) });
  })
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.valid.body;
    const found = await db.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
    const user = found.rows[0];

    // Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails têm conta.
    const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!passwordOk) throw new HttpError(401, 'E-mail ou senha incorretos.');

    const publicUser = { id: user.id, name: user.name, email: user.email };
    res.json({ user: publicUser, token: signToken(publicUser) });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await db.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
    if (!found.rows.length) throw new HttpError(401, 'Conta não encontrada.');
    res.json({ user: found.rows[0] });
  })
);

module.exports = router;
