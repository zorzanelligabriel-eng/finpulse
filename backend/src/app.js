const express = require('express');
const cors = require('cors');
const config = require('./config');
const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { createAssetsRouter } = require('./routes/assets');

// Monta o app sem abrir porta: assim os testes sobem a API numa porta qualquer.
function createApp({ market }) {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', require('./routes/auth'));

  // Daqui para baixo, tudo exige login.
  app.use('/api/categories', requireAuth, require('./routes/categories'));
  app.use('/api/transactions', requireAuth, require('./routes/transactions'));
  app.use('/api/budgets', requireAuth, require('./routes/budgets'));
  app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
  app.use('/api/assets', requireAuth, createAssetsRouter(market));
  app.get('/api/market', requireAuth, (req, res) => res.json(market.getSnapshot()));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
