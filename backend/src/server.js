const http = require('node:http');
const config = require('./config');
const { createApp } = require('./app');
const { pool } = require('./db/pool');
const { migrate } = require('./db/migrate');
const { MarketService } = require('./services/marketService');
const { attachRealtime } = require('./realtime/socket');

async function main() {
  await migrate();

  const market = new MarketService(config.market);
  const server = http.createServer(createApp({ market }));
  const realtime = attachRealtime(server, market);

  // Não espera a primeira cotação para subir: a API de finanças funciona mesmo sem internet.
  market.start().catch((err) => console.warn('[cotações] falha ao iniciar:', err.message));

  server.listen(config.port, () => {
    console.log(`API do FinPulse em http://localhost:${config.port} (cotações: ${config.market.mode})`);
  });

  const shutdown = () => {
    market.stop();
    realtime.close();
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Não foi possível iniciar a API:', err.message);
  console.error('Confira se o PostgreSQL está rodando e se o DATABASE_URL do .env está correto.');
  process.exit(1);
});
