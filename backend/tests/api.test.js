const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { startTestServer } = require('./helpers');

let api;
let server;
let ana; // { token, categories: { Nome: id } }
let bia;

async function createUser(name, email) {
  const { body } = await api('POST', '/api/auth/register', { name, email, password: 'senha-segura' });
  const categories = await api('GET', '/api/categories', null, body.token);
  return {
    token: body.token,
    id: body.user.id,
    categories: Object.fromEntries(categories.body.map((category) => [category.name, category.id])),
  };
}

before(async () => {
  server = await startTestServer();
  api = server.api;
  ana = await createUser('Ana', 'ana@teste.dev');
  bia = await createUser('Bia', 'bia@teste.dev');
});

after(() => server.stop());

test('cadastro: cria conta com categorias padrão e não devolve a senha', async () => {
  const { status, body } = await api('POST', '/api/auth/register', {
    name: 'Caio',
    email: '  CAIO@Teste.dev ',
    password: 'senha-segura',
  });
  assert.equal(status, 201);
  assert.equal(body.user.email, 'caio@teste.dev', 'e-mail é normalizado');
  assert.ok(body.token);
  assert.equal(body.user.password_hash, undefined);

  const categories = await api('GET', '/api/categories', null, body.token);
  assert.equal(categories.body.length, 8);
});

test('cadastro: recusa e-mail repetido e dados inválidos', async () => {
  const duplicate = await api('POST', '/api/auth/register', { name: 'Ana 2', email: 'ana@teste.dev', password: 'senha-segura' });
  assert.equal(duplicate.status, 409);

  const weak = await api('POST', '/api/auth/register', { name: 'Dani', email: 'dani@teste.dev', password: '123' });
  assert.equal(weak.status, 400);
  assert.equal(weak.body.details[0].field, 'password');

  const badEmail = await api('POST', '/api/auth/register', { name: 'Dani', email: 'nao-e-email', password: 'senha-segura' });
  assert.equal(badEmail.status, 400);
});

test('login: aceita a senha certa e recusa a errada com a mesma mensagem', async () => {
  const ok = await api('POST', '/api/auth/login', { email: 'ana@teste.dev', password: 'senha-segura' });
  assert.equal(ok.status, 200);
  const me = await api('GET', '/api/auth/me', null, ok.body.token);
  assert.equal(me.body.user.name, 'Ana');

  const wrongPassword = await api('POST', '/api/auth/login', { email: 'ana@teste.dev', password: 'errada' });
  const unknownEmail = await api('POST', '/api/auth/login', { email: 'ninguem@teste.dev', password: 'senha-segura' });
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.body.error, unknownEmail.body.error);
});

test('rotas protegidas exigem token válido', async () => {
  for (const path of ['/api/transactions', '/api/categories', '/api/budgets', '/api/dashboard', '/api/assets', '/api/market']) {
    assert.equal((await api('GET', path)).status, 401, path);
  }
  assert.equal((await api('GET', '/api/transactions', null, 'token-falso')).status, 401);
  assert.equal((await api('GET', '/api/nao-existe', null, ana.token)).status, 404);
});

test('categorias: cria, edita, impede duplicata e impede apagar em uso', async () => {
  const created = await api('POST', '/api/categories', { name: 'Pets', type: 'expense', color: '#112233' }, ana.token);
  assert.equal(created.status, 201);

  const duplicate = await api('POST', '/api/categories', { name: 'pets', type: 'expense' }, ana.token);
  assert.equal(duplicate.status, 409);

  const renamed = await api('PUT', `/api/categories/${created.body.id}`, { name: 'Animais', color: '#445566' }, ana.token);
  assert.equal(renamed.body.name, 'Animais');
  assert.equal(renamed.body.type, 'expense');

  await api('POST', '/api/transactions', { description: 'Ração', amount: 80, date: '2026-03-02', categoryId: created.body.id }, ana.token);
  const blocked = await api('DELETE', `/api/categories/${created.body.id}`, null, ana.token);
  assert.equal(blocked.status, 409);

  const list = await api('GET', '/api/categories', null, ana.token);
  assert.equal(list.body.find((category) => category.name === 'Animais').transactionCount, 1);

  const empty = await api('POST', '/api/categories', { name: 'Temporária', type: 'income' }, ana.token);
  assert.equal((await api('DELETE', `/api/categories/${empty.body.id}`, null, ana.token)).status, 204);
});

test('lançamentos: valida os dados e herda o tipo da categoria', async () => {
  const created = await api(
    'POST',
    '/api/transactions',
    { description: 'Salário de março', amount: '3200.555', date: '2026-03-05', categoryId: ana.categories['Salário'] },
    ana.token
  );
  assert.equal(created.status, 201);
  assert.equal(created.body.type, 'income');
  assert.equal(created.body.amount, 3200.56, 'arredonda para 2 casas');
  assert.equal(created.body.date, '2026-03-05');
  assert.equal(created.body.categoryName, 'Salário');

  const invalid = [
    { description: 'x', amount: -5, date: '2026-03-05', categoryId: ana.categories['Lazer'] },
    { description: 'x', amount: 0, date: '2026-03-05', categoryId: ana.categories['Lazer'] },
    { description: 'x', amount: 10, date: '2026-02-31', categoryId: ana.categories['Lazer'] },
    { description: 'x', amount: 10, date: '05/03/2026', categoryId: ana.categories['Lazer'] },
    { description: '', amount: 10, date: '2026-03-05', categoryId: ana.categories['Lazer'] },
    { description: 'x', amount: 'abc', date: '2026-03-05', categoryId: ana.categories['Lazer'] },
    { description: 'x', amount: 10, date: '2026-03-05', categoryId: 999999 },
  ];
  for (const body of invalid) {
    const response = await api('POST', '/api/transactions', body, ana.token);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test('lançamentos: pagina, filtra e soma o conjunto filtrado', async () => {
  for (let day = 1; day <= 12; day += 1) {
    await api(
      'POST',
      '/api/transactions',
      { description: `Almoço ${day}`, amount: 10, date: `2026-04-${String(day).padStart(2, '0')}`, categoryId: ana.categories['Alimentação'] },
      ana.token
    );
  }
  await api('POST', '/api/transactions', { description: 'Uber', amount: 25, date: '2026-04-03', categoryId: ana.categories['Transporte'] }, ana.token);

  const page1 = await api('GET', '/api/transactions?from=2026-04-01&to=2026-04-30&limit=5', null, ana.token);
  assert.equal(page1.body.data.length, 5);
  assert.deepEqual(page1.body.pagination, { page: 1, limit: 5, total: 13, totalPages: 3 });
  assert.equal(page1.body.data[0].description, 'Almoço 12', 'mais recente primeiro');
  assert.deepEqual(page1.body.totals, { income: 0, expense: 145, balance: -145 });

  const page3 = await api('GET', '/api/transactions?from=2026-04-01&to=2026-04-30&limit=5&page=3', null, ana.token);
  assert.equal(page3.body.data.length, 3);

  const byCategory = await api('GET', `/api/transactions?categoryId=${ana.categories['Transporte']}`, null, ana.token);
  assert.equal(byCategory.body.pagination.total, 1);

  const search = await api('GET', '/api/transactions?q=almoço%201', null, ana.token);
  assert.equal(search.body.pagination.total, 4, 'Almoço 1, 10, 11 e 12');

  const incomes = await api('GET', '/api/transactions?type=income', null, ana.token);
  assert.ok(incomes.body.data.every((item) => item.type === 'income'));

  assert.equal((await api('GET', '/api/transactions?limit=1000', null, ana.token)).status, 400);
  // tentativa de SQL injection vira texto de busca comum
  const injection = await api('GET', `/api/transactions?q=${encodeURIComponent("' OR 1=1 --")}`, null, ana.token);
  assert.equal(injection.status, 200);
  assert.equal(injection.body.pagination.total, 0);
});

test('lançamentos: edita e exclui', async () => {
  const created = await api('POST', '/api/transactions', { description: 'Cinema', amount: 40, date: '2026-05-10', categoryId: ana.categories['Lazer'] }, ana.token);
  const updated = await api(
    'PUT',
    `/api/transactions/${created.body.id}`,
    { description: 'Freela', amount: 300, date: '2026-05-11', categoryId: ana.categories['Renda extra'] },
    ana.token
  );
  assert.equal(updated.body.type, 'income', 'trocar a categoria troca o tipo');
  assert.equal(updated.body.amount, 300);

  assert.equal((await api('DELETE', `/api/transactions/${created.body.id}`, null, ana.token)).status, 204);
  assert.equal((await api('DELETE', `/api/transactions/${created.body.id}`, null, ana.token)).status, 404);
  assert.equal((await api('DELETE', '/api/transactions/abc', null, ana.token)).status, 400);
});

test('um usuário não enxerga nem altera dados de outro', async () => {
  const mine = await api('POST', '/api/transactions', { description: 'Segredo da Ana', amount: 10, date: '2026-06-01', categoryId: ana.categories['Lazer'] }, ana.token);

  const biaList = await api('GET', '/api/transactions?limit=100', null, bia.token);
  assert.equal(biaList.body.pagination.total, 0);

  const body = { description: 'Invasão', amount: 1, date: '2026-06-01', categoryId: bia.categories['Lazer'] };
  assert.equal((await api('PUT', `/api/transactions/${mine.body.id}`, body, bia.token)).status, 404);
  assert.equal((await api('DELETE', `/api/transactions/${mine.body.id}`, null, bia.token)).status, 404);

  // Bia tentando lançar na categoria da Ana
  const foreignCategory = await api('POST', '/api/transactions', { ...body, categoryId: ana.categories['Lazer'] }, bia.token);
  assert.equal(foreignCategory.status, 400);
  assert.equal((await api('PUT', `/api/categories/${ana.categories['Lazer']}`, { name: 'Hack', color: '#000000' }, bia.token)).status, 404);
  assert.equal((await api('PUT', '/api/budgets', { categoryId: ana.categories['Lazer'], month: '2026-06', limit: 10 }, bia.token)).status, 400);
});

test('orçamentos: cria/atualiza por mês e calcula a situação', async () => {
  const month = '2026-07';
  const spend = (categoryName, amount) =>
    api('POST', '/api/transactions', { description: 'Gasto', amount, date: `${month}-15`, categoryId: bia.categories[categoryName] }, bia.token);
  await spend('Alimentação', 300); // 50% de 600
  await spend('Transporte', 170); // 85% de 200
  await spend('Lazer', 150); // 150% de 100
  // gasto de outro mês não pode contar
  await api('POST', '/api/transactions', { description: 'Agosto', amount: 999, date: '2026-08-01', categoryId: bia.categories['Lazer'] }, bia.token);

  await api('PUT', '/api/budgets', { categoryId: bia.categories['Alimentação'], month, limit: 600 }, bia.token);
  await api('PUT', '/api/budgets', { categoryId: bia.categories['Transporte'], month, limit: 200 }, bia.token);
  const first = await api('PUT', '/api/budgets', { categoryId: bia.categories['Lazer'], month, limit: 50 }, bia.token);
  const lazer = await api('PUT', '/api/budgets', { categoryId: bia.categories['Lazer'], month, limit: 100 }, bia.token);
  assert.equal(lazer.body.id, first.body.id, 'segundo PUT atualiza o mesmo orçamento');
  assert.deepEqual(
    { limit: lazer.body.limit, spent: lazer.body.spent, remaining: lazer.body.remaining, percent: lazer.body.percent, status: lazer.body.status },
    { limit: 100, spent: 150, remaining: -50, percent: 150, status: 'over' }
  );

  const list = await api('GET', `/api/budgets?month=${month}`, null, bia.token);
  assert.deepEqual(
    list.body.map((budget) => [budget.categoryName, budget.status]),
    [['Alimentação', 'ok'], ['Lazer', 'over'], ['Transporte', 'warning']]
  );

  const income = await api('PUT', '/api/budgets', { categoryId: bia.categories['Salário'], month, limit: 100 }, bia.token);
  assert.equal(income.status, 400, 'categoria de receita não tem orçamento');
  assert.equal((await api('GET', '/api/budgets?month=2026-13', null, bia.token)).status, 400);

  assert.equal((await api('DELETE', `/api/budgets/${first.body.id}`, null, bia.token)).status, 204);
  assert.equal((await api('GET', `/api/budgets?month=${month}`, null, bia.token)).body.length, 2);
});

test('dashboard: resumo do mês, gastos por categoria, histórico e alertas', async () => {
  await api('POST', '/api/transactions', { description: 'Salário', amount: 2000, date: '2026-07-05', categoryId: bia.categories['Salário'] }, bia.token);
  await api('POST', '/api/transactions', { description: 'Mercado', amount: 80, date: '2026-05-20', categoryId: bia.categories['Alimentação'] }, bia.token);

  const { status, body } = await api('GET', '/api/dashboard?month=2026-07', null, bia.token);
  assert.equal(status, 200);
  assert.equal(body.income, 2000);
  assert.equal(body.expense, 620);
  assert.equal(body.balance, 1380);
  assert.deepEqual(
    body.byCategory.map((item) => [item.name, item.total]),
    [['Alimentação', 300], ['Transporte', 170], ['Lazer', 150]]
  );
  assert.deepEqual(
    body.history.map((item) => item.month),
    ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']
  );
  assert.deepEqual(body.history[3], { month: '2026-05', income: 0, expense: 80 });
  assert.deepEqual(body.history[4], { month: '2026-06', income: 0, expense: 0 }, 'mês vazio vem zerado');
  assert.deepEqual(body.history[5], { month: '2026-07', income: 2000, expense: 620 });
  assert.deepEqual(body.budgetAlerts.map((alert) => alert.categoryName), ['Transporte']);
});

test('carteira: adiciona ativos cotados e calcula o patrimônio', async () => {
  const btc = await api('POST', '/api/assets', { kind: 'crypto', code: 'Bitcoin', quantity: 0.01, investedBrl: 4000 }, ana.token);
  assert.equal(btc.status, 201);
  assert.deepEqual(
    { code: btc.body.code, symbol: btc.body.symbol, name: btc.body.name, quantity: btc.body.quantity, investedBrl: btc.body.investedBrl },
    { code: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', quantity: 0.01, investedBrl: 4000 }
  );
  const usd = await api('POST', '/api/assets', { kind: 'currency', code: 'usd', quantity: 200 }, ana.token);
  assert.equal(usd.body.investedBrl, null);

  assert.equal((await api('POST', '/api/assets', { kind: 'crypto', code: 'bitcoin', quantity: 1 }, ana.token)).status, 409);
  assert.equal((await api('POST', '/api/assets', { kind: 'crypto', code: 'moeda-inventada', quantity: 1 }, ana.token)).status, 400);
  assert.equal((await api('POST', '/api/assets', { kind: 'crypto', code: 'ethereum', quantity: 0 }, ana.token)).status, 400);

  const wallet = await api('GET', '/api/assets', null, ana.token);
  assert.equal(wallet.body.positions.length, 2);
  assert.equal(wallet.body.totals.totalBrl, 6000); // 0,01 BTC a 500 mil + 200 USD a 5
  assert.equal(wallet.body.totals.profitBrl, 1000);
  assert.equal(wallet.body.totals.change24hBrl, 1000); // BTC subiu 25%: valia 4.000

  // cotação muda -> patrimônio muda
  server.market.snapshot.crypto[0].priceBrl = 600000;
  assert.equal((await api('GET', '/api/assets', null, ana.token)).body.totals.totalBrl, 7000);
  server.market.snapshot.crypto[0].priceBrl = 500000;

  const edited = await api('PUT', `/api/assets/${usd.body.id}`, { quantity: 0.00000001, investedBrl: null }, ana.token);
  assert.equal(edited.body.quantity, 0.00000001, 'guarda 8 casas decimais');

  assert.equal((await api('DELETE', `/api/assets/${btc.body.id}`, null, bia.token)).status, 404, 'ativo de outro usuário');
  assert.equal((await api('DELETE', `/api/assets/${btc.body.id}`, null, ana.token)).status, 204);
  assert.equal((await api('GET', '/api/assets', null, bia.token)).body.positions.length, 0);
});

test('GET /api/market devolve a cotação em cache', async () => {
  const { body } = await api('GET', '/api/market', null, ana.token);
  assert.equal(body.crypto[0].id, 'bitcoin');
  assert.equal(body.currencies[0].code, 'USD');
});

// Abre o WebSocket e junta as mensagens recebidas.
function connect(token) {
  const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws?token=${token}`);
  const messages = [];
  const waiters = [];
  socket.on('message', (raw) => {
    messages.push(JSON.parse(raw.toString()));
    waiters.splice(0).forEach((resolve) => resolve());
  });
  const waitFor = async (count) => {
    while (messages.length < count) await new Promise((resolve) => waiters.push(resolve));
    return messages;
  };
  return { socket, waitFor };
}

test('tempo real: envia a cotação ao conectar e a cada atualização, para todos', async () => {
  const first = connect(ana.token);
  const second = connect(bia.token);
  const [initial] = await first.waitFor(1);
  await second.waitFor(1);
  assert.equal(initial.type, 'market');
  assert.equal(initial.data.crypto[0].priceBrl, 500000);

  // simula a chegada de uma nova rodada de cotações
  const next = structuredClone(server.market.getSnapshot());
  next.crypto[0].priceBrl = 512345;
  server.market.snapshot = next;
  server.market.emit('update', next);

  assert.equal((await first.waitFor(2))[1].data.crypto[0].priceBrl, 512345);
  assert.equal((await second.waitFor(2))[1].data.crypto[0].priceBrl, 512345);
  first.socket.close();
  second.socket.close();
});

test('tempo real: recusa conexão sem token válido', async () => {
  const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws?token=invalido`);
  const outcome = await new Promise((resolve) => {
    socket.on('open', () => resolve('open'));
    socket.on('unexpected-response', (request, response) => resolve(response.statusCode));
    socket.on('error', () => resolve('error'));
  });
  assert.equal(outcome, 401);
});
