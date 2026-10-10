const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MarketService } = require('../src/services/marketService');

// Respostas no formato real das duas APIs (campos resumidos).
const COINGECKO = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: 'https://img/btc.png', current_price: 600000, market_cap: 1, market_cap_rank: 1, price_change_percentage_24h: 1.5 },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', image: 'https://img/eth.png', current_price: 20000, market_cap: 1, market_cap_rank: 2, price_change_percentage_24h: null },
];
const AWESOME = {
  USDBRL: { code: 'USD', codein: 'BRL', name: 'Dólar Americano/Real Brasileiro', high: '5.50', low: '5.30', pctChange: '-0.42', bid: '5.4012' },
  EURBRL: { code: 'EUR', codein: 'BRL', name: 'Euro/Real Brasileiro', high: '6.40', low: '6.20', pctChange: '0.1', bid: '6.3' },
};

// fetch falso: responde conforme o endereço e permite simular quedas.
function fakeFetch({ coingeckoDown = false, awesomeDown = false } = {}) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    const isCrypto = url.includes('coingecko');
    if ((isCrypto && coingeckoDown) || (!isCrypto && awesomeDown)) return { ok: false, status: 429, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => (isCrypto ? COINGECKO : AWESOME) };
  };
  impl.calls = calls;
  return impl;
}

const silently = async (fn) => {
  const original = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = original;
  }
};

test('converte as respostas das APIs para o formato do app', async () => {
  const market = new MarketService({ currencies: ['USD', 'EUR'], fetchImpl: fakeFetch() });
  const snapshot = await market.refresh();

  assert.equal(snapshot.status, 'live');
  assert.deepEqual(snapshot.crypto[0], {
    id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: 'https://img/btc.png', rank: 1, priceBrl: 600000, change24h: 1.5, marketCapBrl: 1,
  });
  assert.equal(snapshot.crypto[1].change24h, 0, 'variação ausente vira zero');
  assert.deepEqual(snapshot.currencies[0], {
    code: 'USD', name: 'Dólar americano', priceBrl: 5.4012, change24h: -0.42, high: 5.5, low: 5.3,
  });
});

test('pede as moedas configuradas e envia as chaves quando existem', async () => {
  const fetchImpl = fakeFetch();
  const market = new MarketService({ currencies: ['USD', 'EUR'], coingeckoKey: 'cg', awesomeToken: 'aw', fetchImpl });
  await market.refresh();

  const awesome = fetchImpl.calls.find((call) => call.url.includes('awesomeapi'));
  const coingecko = fetchImpl.calls.find((call) => call.url.includes('coingecko'));
  assert.ok(awesome.url.endsWith('/json/last/USD-BRL,EUR-BRL'));
  assert.equal(awesome.options.headers['x-api-key'], 'aw');
  assert.equal(coingecko.options.headers['x-cg-demo-api-key'], 'cg');
  assert.ok(coingecko.url.includes('vs_currency=brl') && coingecko.url.includes('per_page=10'));
});

test('se uma fonte cai, mantém os últimos valores dela e marca "partial"', async () => {
  const market = new MarketService({ currencies: ['USD', 'EUR'], fetchImpl: fakeFetch() });
  await market.refresh();

  market.fetch = fakeFetch({ coingeckoDown: true });
  const snapshot = await silently(() => market.refresh());
  assert.equal(snapshot.status, 'partial');
  assert.equal(snapshot.crypto.length, 2, 'criptos antigas continuam disponíveis');
  assert.equal(snapshot.currencies.length, 2);
});

test('se tudo cai, serve o cache como "stale"; sem cache, "unavailable"', async () => {
  const market = new MarketService({ currencies: ['USD'], fetchImpl: fakeFetch() });
  const first = await market.refresh();

  market.fetch = fakeFetch({ coingeckoDown: true, awesomeDown: true });
  const stale = await silently(() => market.refresh());
  assert.equal(stale.status, 'stale');
  assert.equal(stale.updatedAt, first.updatedAt, 'horário continua o da última cotação válida');
  assert.equal(stale.crypto.length, 2);

  const empty = new MarketService({ fetchImpl: fakeFetch({ coingeckoDown: true, awesomeDown: true }) });
  const snapshot = await silently(() => empty.refresh());
  assert.equal(snapshot.status, 'unavailable');
  assert.deepEqual(snapshot.crypto, []);
});

test('emite "update" a cada atualização', async () => {
  const market = new MarketService({ mode: 'mock', currencies: ['USD'] });
  const received = [];
  market.on('update', (snapshot) => received.push(snapshot));
  await market.refresh();
  await market.refresh();

  assert.equal(received.length, 2);
  assert.equal(received[0].status, 'mock');
  assert.equal(received[0].crypto.length, 10);
  assert.notEqual(received[0].crypto[0].priceBrl, received[1].crypto[0].priceBrl, 'o preço simulado se move');
});
