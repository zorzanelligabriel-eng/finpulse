import { useMarket } from '../context/MarketContext';
import { formatPercent, formatPrice, formatTime } from '../utils/format';
import LiveValue from './LiveValue';

const STATUS_TEXT = {
  live: 'Ao vivo',
  mock: 'Simulado',
  partial: 'Parcial',
  stale: 'Desatualizado',
  unavailable: 'Sem cotações',
  loading: 'Conectando',
};

// Faixa de cotações no topo de todas as telas.
export default function Ticker() {
  const { market, connected } = useMarket();
  const status = connected ? market.status : 'loading';

  const items = [
    ...market.currencies.map((currency) => ({ key: currency.code, label: currency.code, ...currency })),
    ...market.crypto.map((coin) => ({ key: coin.id, label: coin.symbol, ...coin })),
  ];

  return (
    <div className="ticker" role="region" aria-label="Cotações">
      <span className={`ticker-status is-${status}`} title={`Última atualização: ${formatTime(market.updatedAt)}`}>
        {STATUS_TEXT[status] ?? status}
      </span>
      <div className="ticker-track">
        {items.length === 0 && <span className="ticker-empty">Aguardando a primeira cotação…</span>}
        {items.map((item) => (
          <span className="ticker-item" key={item.key}>
            <b>{item.label}</b>
            <LiveValue value={item.priceBrl} format={formatPrice} />
            <span className={item.change24h >= 0 ? 'up' : 'down'}>{formatPercent(item.change24h)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
