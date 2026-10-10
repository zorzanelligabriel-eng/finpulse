require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

const config = {
  isTest,
  port: Number(process.env.PORT) || 3333,
  databaseUrl: isTest
    ? process.env.TEST_DATABASE_URL || 'postgres://finpulse:finpulse@localhost:5432/finpulse_test'
    : process.env.DATABASE_URL || 'postgres://finpulse:finpulse@localhost:5432/finpulse',
  jwtSecret: process.env.JWT_SECRET || 'segredo-apenas-para-desenvolvimento',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  market: {
    mode: process.env.MARKET_MODE || 'live',
    refreshMs: Number(process.env.MARKET_REFRESH_MS) || 60_000,
    currencies: (process.env.MARKET_CURRENCIES || 'USD,EUR,GBP')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    coingeckoKey: process.env.COINGECKO_API_KEY || '',
    awesomeToken: process.env.AWESOMEAPI_TOKEN || '',
  },
};

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('Defina JWT_SECRET antes de rodar em produção.');
}

module.exports = config;
