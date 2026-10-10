const { EventEmitter } = require('node:events');

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&order=market_cap_desc&per_page=10&page=1&price_change_percentage=24h';
const AWESOMEAPI_URL = 'https://economia.awesomeapi.com.br/json/last/';

const CURRENCY_NAMES = { USD: 'Dólar americano', EUR: 'Euro', GBP: 'Libra esterlina', ARS: 'Peso argentino', JPY: 'Iene japonês' };

// Preços de partida do modo simulado (MARKET_MODE=mock). Não são cotações reais.
const MOCK_CRYPTO = [
  ['bitcoin', 'btc', 'Bitcoin', 612000],
  ['ethereum', 'eth', 'Ethereum', 21400],
  ['tether', 'usdt', 'Tether', 5.42],
  ['ripple', 'xrp', 'XRP', 14.1],
  ['binancecoin', 'bnb', 'BNB', 4650],
  ['solana', 'sol', 'Solana', 1040],
  ['usd-coin', 'usdc', 'USDC', 5.41],
  ['dogecoin', 'doge', 'Dogecoin', 1.18],
  ['tron', 'trx', 'TRON', 1.71],
  ['cardano', 'ada', 'Cardano', 3.92],
];
const MOCK_CURRENCIES = { USD: 5.41, EUR: 6.32, GBP: 7.25, ARS: 0.0041, JPY: 0.036 };

/**
 * Busca as cotações de tempos em tempos, guarda a última em memória (cache)
 * e emite o evento "update" a cada novidade. Quem quiser os preços
 * (rota REST ou WebSocket) lê daqui, nunca direto das APIs externas.
 */
class MarketService extends EventEmitter {
  constructor({ mode = 'live', refreshMs = 60_000, currencies = ['USD', 'EUR'], coingeckoKey = '', awesomeToken = '', fetchImpl = fetch } = {}) {
    super();
    this.mode = mode;
    this.refreshMs = mode === 'mock' ? Math.min(refreshMs, 3000) : refreshMs;
    this.currencies = currencies;
    this.coingeckoKey = coingeckoKey;
    this.awesomeToken = awesomeToken;
    this.fetch = fetchImpl;
    this.timer = null;
    this.snapshot = { status: 'loading', updatedAt: null, crypto: [], currencies: [] };
  }

  getSnapshot() {
    return this.snapshot;
  }

  async start() {
    await this.refresh();
    this.timer = setInterval(() => this.refresh(), this.refreshMs);
    // não segura o processo aberto só por causa do timer
    this.timer.unref();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  async refresh() {
    if (this.mode === 'mock') {
      this.snapshot = this.nextMockSnapshot();
    } else {
      // allSettled: se uma das fontes cair, a outra continua atualizando.
      const [crypto, currencies] = await Promise.allSettled([this.fetchCrypto(), this.fetchCurrencies()]);
      const failures = [crypto, currencies].filter((result) => result.status === 'rejected');
      failures.forEach((failure) => console.warn('[cotações]', failure.reason.message));

      const previous = this.snapshot;
      const hasOldData = previous.crypto.length > 0 || previous.currencies.length > 0;
      let status = 'live';
      if (failures.length === 1) status = 'partial';
      if (failures.length === 2) status = hasOldData ? 'stale' : 'unavailable';

      this.snapshot = {
        status,
        // quando tudo falha, mantém o horário da última cotação válida
        updatedAt: failures.length === 2 ? previous.updatedAt : new Date().toISOString(),
        crypto: crypto.status === 'fulfilled' ? crypto.value : previous.crypto,
        currencies: currencies.status === 'fulfilled' ? currencies.value : previous.currencies,
      };
    }
    this.emit('update', this.snapshot);
    return this.snapshot;
  }

  async getJson(url, headers) {
    const response = await this.fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`${new URL(url).hostname} respondeu ${response.status}`);
    return response.json();
  }

  async fetchCrypto() {
    const headers = this.coingeckoKey ? { 'x-cg-demo-api-key': this.coingeckoKey } : {};
    const coins = await this.getJson(COINGECKO_URL, headers);
    return coins.map(normalizeCoin);
  }

  async fetchCurrencies() {
    const pairs = this.currencies.map((code) => `${code}-BRL`).join(',');
    const headers = this.awesomeToken ? { 'x-api-key': this.awesomeToken } : {};
    const quotes = await this.getJson(AWESOMEAPI_URL + pairs, headers);
    return Object.values(quotes).map(normalizeCurrency);
  }

  // Passeio aleatório: cada preço varia até ±0,4% por atualização.
  nextMockSnapshot() {
    const drift = (price) => price * (1 + (Math.random() - 0.5) * 0.008);
    const previousCrypto = new Map(this.snapshot.crypto.map((coin) => [coin.id, coin]));
    const previousCurrencies = new Map(this.snapshot.currencies.map((currency) => [currency.code, currency]));

    return {
      status: 'mock',
      updatedAt: new Date().toISOString(),
      crypto: MOCK_CRYPTO.map(([id, symbol, name, basePrice], index) => {
        const priceBrl = drift(previousCrypto.get(id)?.priceBrl ?? basePrice);
        return {
          id,
          symbol: symbol.toUpperCase(),
          name,
          image: null,
          rank: index + 1,
          priceBrl,
          change24h: ((priceBrl - basePrice) / basePrice) * 100,
          marketCapBrl: null,
        };
      }),
      currencies: this.currencies
        .filter((code) => MOCK_CURRENCIES[code])
        .map((code) => {
          const basePrice = MOCK_CURRENCIES[code];
          const priceBrl = drift(previousCurrencies.get(code)?.priceBrl ?? basePrice);
          return {
            code,
            name: CURRENCY_NAMES[code] || code,
            priceBrl,
            change24h: ((priceBrl - basePrice) / basePrice) * 100,
            high: null,
            low: null,
          };
        }),
    };
  }
}

// Converte a resposta do CoinGecko para o formato usado no app.
function normalizeCoin(coin) {
  return {
    id: coin.id,
    symbol: String(coin.symbol).toUpperCase(),
    name: coin.name,
    image: coin.image || null,
    rank: coin.market_cap_rank,
    priceBrl: Number(coin.current_price),
    change24h: Number(coin.price_change_percentage_24h ?? 0),
    marketCapBrl: coin.market_cap ?? null,
  };
}

// Converte a resposta da AwesomeAPI (que manda números como texto).
function normalizeCurrency(quote) {
  return {
    code: quote.code,
    name: CURRENCY_NAMES[quote.code] || String(quote.name).split('/')[0],
    priceBrl: Number(quote.bid),
    change24h: Number(quote.pctChange),
    high: Number(quote.high),
    low: Number(quote.low),
  };
}

// Procura um ativo na cotação atual. Devolve null se não estiver na lista.
function findQuote(snapshot, kind, code) {
  if (kind === 'crypto') {
    const coin = snapshot.crypto.find((item) => item.id === code);
    return coin ? { code: coin.id, symbol: coin.symbol, name: coin.name, priceBrl: coin.priceBrl, change24h: coin.change24h } : null;
  }
  const currency = snapshot.currencies.find((item) => item.code === code);
  return currency
    ? { code: currency.code, symbol: currency.code, name: currency.name, priceBrl: currency.priceBrl, change24h: currency.change24h }
    : null;
}

module.exports = { MarketService, normalizeCoin, normalizeCurrency, findQuote };
