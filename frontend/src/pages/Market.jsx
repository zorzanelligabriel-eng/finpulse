import { useMarket } from '../context/MarketContext';
import { formatPercent, formatPrice, formatTime } from '../utils/format';
import LiveValue from '../components/LiveValue';
import Sparkline from '../components/charts/Sparkline';

const STATUS_NOTE = {
  mock: 'Preços simulados (MARKET_MODE=mock). Não representam o mercado real.',
  partial: 'Uma das fontes não respondeu; parte dos preços é da última consulta que deu certo.',
  stale: 'As fontes não responderam; mostrando os últimos preços recebidos.',
  unavailable: 'Não foi possível obter cotações. O servidor tenta de novo sozinho.',
};

export default function Market() {
  const { market, connected, history } = useMarket();

  return (
    <>
      <header className="page-header">
        <h1>Mercado</h1>
        <p className="muted">
          {connected ? `Atualizado às ${formatTime(market.updatedAt)}` : 'Reconectando ao servidor…'}
        </p>
      </header>

      {STATUS_NOTE[market.status] && <p className="notice">{STATUS_NOTE[market.status]}</p>}

      <div className="currency-cards">
        {market.currencies.map((currency) => (
          <section className="card currency" key={currency.code}>
            <h2>{currency.name}</h2>
            <LiveValue className="currency-price" value={currency.priceBrl} format={formatPrice} />
            <p>
              <span className={currency.change24h >= 0 ? 'up' : 'down'}>{formatPercent(currency.change24h)}</span>
              {currency.low != null && (
                <span className="muted"> mín. {formatPrice(currency.low)}, máx. {formatPrice(currency.high)}</span>
              )}
            </p>
            <Sparkline points={history[`currency:${currency.code}`]} width={220} height={36} />
          </section>
        ))}
      </div>

      <section className="card flush">
        <h2 className="card-title">As 10 maiores criptomoedas</h2>
        {market.crypto.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="num narrow">#</th>
                  <th>Moeda</th>
                  <th className="num">Preço</th>
                  <th className="num">24h</th>
                  <th className="num">Desde que você abriu</th>
                </tr>
              </thead>
              <tbody>
                {market.crypto.map((coin) => (
                  <tr key={coin.id}>
                    <td className="num narrow muted">{coin.rank}</td>
                    <td>
                      <span className="coin">
                        {coin.image && <img src={coin.image} alt="" width="22" height="22" loading="lazy" />}
                        <b>{coin.name}</b> <span className="muted">{coin.symbol}</span>
                      </span>
                    </td>
                    <td className="num"><LiveValue value={coin.priceBrl} format={formatPrice} /></td>
                    <td className={`num ${coin.change24h >= 0 ? 'up' : 'down'}`}>{formatPercent(coin.change24h)}</td>
                    <td className="num"><Sparkline points={history[`crypto:${coin.id}`]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Aguardando a primeira cotação…</p>
        )}
      </section>

      <p className="muted small">Fontes: CoinGecko (criptomoedas) e AwesomeAPI (moedas). Valores informativos, não são recomendação de investimento.</p>
    </>
  );
}
