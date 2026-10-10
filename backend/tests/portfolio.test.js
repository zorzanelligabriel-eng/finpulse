const { test } = require('node:test');
const assert = require('node:assert/strict');
const { valuatePortfolio } = require('../src/services/portfolio');

const snapshot = {
  crypto: [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', priceBrl: 500000, change24h: 25 },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', priceBrl: 20000, change24h: -20 },
  ],
  currencies: [{ code: 'USD', name: 'Dólar americano', priceBrl: 5, change24h: 0 }],
};

test('calcula valor, lucro e variação de cada posição', () => {
  const { positions } = valuatePortfolio(
    [{ id: 1, kind: 'crypto', code: 'bitcoin', quantity: 0.01, investedBrl: 4000 }],
    snapshot
  );
  assert.equal(positions[0].valueBrl, 5000);
  assert.equal(positions[0].profitBrl, 1000);
  assert.equal(positions[0].profitPercent, 25);
  assert.equal(positions[0].change24h, 25);
});

test('soma a carteira e calcula a variação em 24h', () => {
  const { totals } = valuatePortfolio(
    [
      { id: 1, kind: 'crypto', code: 'bitcoin', quantity: 0.01, investedBrl: 4000 }, // vale 5.000, valia 4.000
      { id: 2, kind: 'crypto', code: 'ethereum', quantity: 0.1, investedBrl: 2500 }, // vale 2.000, valia 2.500
      { id: 3, kind: 'currency', code: 'USD', quantity: 200, investedBrl: null }, // vale 1.000, sem custo
    ],
    snapshot
  );
  assert.equal(totals.totalBrl, 8000);
  assert.equal(totals.change24hBrl, 500); // 8.000 agora contra 7.500 um dia antes
  assert.equal(totals.change24hPercent, 6.67);
  assert.equal(totals.investedBrl, 6500, 'só entra o que tem custo informado');
  assert.equal(totals.profitBrl, 500);
  assert.equal(totals.profitPercent, 7.69);
});

test('ativo sem cotação não entra no total e não quebra o cálculo', () => {
  const { positions, totals } = valuatePortfolio(
    [
      { id: 1, kind: 'crypto', code: 'moeda-que-saiu-do-top-10', quantity: 10, investedBrl: 100 },
      { id: 2, kind: 'currency', code: 'USD', quantity: 10, investedBrl: null },
    ],
    snapshot
  );
  assert.equal(positions[0].valueBrl, null);
  assert.equal(totals.totalBrl, 50);
  assert.equal(totals.investedBrl, 0);
  assert.equal(totals.profitPercent, null);
});

test('carteira vazia devolve zeros', () => {
  const { positions, totals } = valuatePortfolio([], snapshot);
  assert.deepEqual(positions, []);
  assert.equal(totals.totalBrl, 0);
  assert.equal(totals.change24hPercent, 0);
});
