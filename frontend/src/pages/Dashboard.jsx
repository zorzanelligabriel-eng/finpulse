import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../context/MarketContext';
import { useFetch } from '../utils/useFetch';
import { valuatePortfolio } from '../utils/portfolio';
import { currentMonth, formatMoney, formatPercent, formatTime } from '../utils/format';
import MonthPicker from '../components/MonthPicker';
import LiveValue from '../components/LiveValue';
import Donut from '../components/charts/Donut';
import MonthlyBars from '../components/charts/MonthlyBars';

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth);
  const dashboard = useFetch(`/dashboard?month=${month}`);
  const wallet = useFetch('/assets');
  const { market } = useMarket();

  // Recalcula o patrimônio a cada cotação nova, sem chamar a API.
  const portfolio = useMemo(() => {
    if (!wallet.data) return null;
    const assets = wallet.data.positions;
    return market.crypto.length || market.currencies.length ? valuatePortfolio(assets, market) : wallet.data;
  }, [wallet.data, market]);

  const data = dashboard.data;

  return (
    <>
      <header className="page-header">
        <h1>Visão geral</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      {dashboard.error && <p className="form-error" role="alert">{dashboard.error}</p>}

      <div className="grid overview">
        <section className="net-worth">
          <h2>Carteira agora</h2>
          {portfolio && portfolio.positions.length > 0 ? (
            <>
              <LiveValue className="net-worth-value" value={portfolio.totals.totalBrl} format={formatMoney} />
              <p>
                <span className={portfolio.totals.change24hBrl >= 0 ? 'up' : 'down'}>
                  {formatMoney(portfolio.totals.change24hBrl)} ({formatPercent(portfolio.totals.change24hPercent)})
                </span>{' '}
                nas últimas 24h
              </p>
              <p className="net-worth-foot">
                {portfolio.positions.length} {portfolio.positions.length === 1 ? 'ativo' : 'ativos'}, cotação das{' '}
                {formatTime(market.updatedAt)}. <Link to="/carteira">Abrir carteira</Link>
              </p>
            </>
          ) : (
            <>
              <p className="net-worth-empty">Você ainda não cadastrou ativos.</p>
              <p className="net-worth-foot">
                Informe quanto você tem de dólar, euro ou cripto e veja o valor em reais mudar ao vivo.{' '}
                <Link to="/carteira">Adicionar ativo</Link>
              </p>
            </>
          )}
        </section>

        <section className="card month-summary">
          <h2>Resultado do mês</h2>
          <dl>
            <div>
              <dt>Receitas</dt>
              <dd className="up">{formatMoney(data?.income)}</dd>
            </div>
            <div>
              <dt>Despesas</dt>
              <dd className="down">{formatMoney(data?.expense)}</dd>
            </div>
            <div className="month-balance">
              <dt>Saldo</dt>
              <dd>{formatMoney(data?.balance)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="grid halves">
        <section className="card">
          <h2>Para onde foi o dinheiro</h2>
          {data?.byCategory.length ? (
            <Donut centerLabel="Despesas" slices={data.byCategory.map((item) => ({ label: item.name, value: item.total, color: item.color }))} />
          ) : (
            <p className="empty">
              Nenhuma despesa neste mês. <Link to="/lancamentos">Registrar um lançamento</Link>
            </p>
          )}
        </section>

        <section className="card">
          <h2>Últimos 6 meses</h2>
          {data && <MonthlyBars data={data.history} />}
        </section>
      </div>

      {data?.budgetAlerts.length > 0 && (
        <section className="card">
          <h2>Orçamentos que pedem atenção</h2>
          <ul className="alerts">
            {data.budgetAlerts.map((alert) => (
              <li key={alert.id} className={`is-${alert.status}`}>
                <b>{alert.categoryName}</b>
                <span>
                  {alert.status === 'over'
                    ? `Passou ${formatMoney(-alert.remaining)} do limite de ${formatMoney(alert.limit)}`
                    : `${alert.percent}% do limite usado, restam ${formatMoney(alert.remaining)}`}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/orcamentos">Ver orçamentos</Link>
        </section>
      )}
    </>
  );
}
