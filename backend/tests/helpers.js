process.env.NODE_ENV = 'test';

const http = require('node:http');
const config = require('../src/config');
const { pool } = require('../src/db/pool');
const { migrate } = require('../src/db/migrate');
const { createApp } = require('../src/app');
const { MarketService } = require('../src/services/marketService');
const { attachRealtime } = require('../src/realtime/socket');

// Cotações fixas para os testes: os cálculos ficam previsíveis.
function fakeMarket() {
  const market = new MarketService({ mode: 'mock', currencies: ['USD', 'EUR'] });
  market.snapshot = {
    status: 'mock',
    updatedAt: '2026-01-01T12:00:00.000Z',
    crypto: [
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null, rank: 1, priceBrl: 500000, change24h: 25, marketCapBrl: null },
      { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null, rank: 2, priceBrl: 20000, change24h: -20, marketCapBrl: null },
    ],
    currencies: [{ code: 'USD', name: 'Dólar americano', priceBrl: 5, change24h: 0, high: 5.1, low: 4.9 }],
  };
  return market;
}

// Sobe a API numa porta livre com banco de teste zerado.
async function startTestServer() {
  if (!/test/i.test(config.databaseUrl)) {
    throw new Error('Os testes apagam os dados do banco. Use um TEST_DATABASE_URL com "test" no nome.');
  }
  await migrate();
  await pool.query('TRUNCATE users, categories, transactions, budgets, assets RESTART IDENTITY CASCADE');

  const market = fakeMarket();
  const server = http.createServer(createApp({ market }));
  const realtime = attachRealtime(server, market);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  // Pequeno cliente HTTP: api('POST', '/api/x', corpo, token) -> { status, body }
  async function api(method, path, body, token) {
    const response = await fetch(baseUrl + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function stop() {
    realtime.close();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  return { api, market, port, stop };
}

module.exports = { startTestServer, fakeMarket };
