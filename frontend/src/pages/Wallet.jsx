import { useMemo, useState } from 'react';
import { api } from '../api/client';
import { useMarket } from '../context/MarketContext';
import { useFetch } from '../utils/useFetch';
import { valuatePortfolio } from '../utils/portfolio';
import { formatMoney, formatPercent, formatPrice, formatQuantity, formatTime, parseNumber } from '../utils/format';
import LiveValue from '../components/LiveValue';
import Modal from '../components/Modal';

export default function Wallet() {
  const wallet = useFetch('/assets');
  const { market } = useMarket();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const hasQuotes = market.crypto.length > 0 || market.currencies.length > 0;

  // A API manda a carteira já calculada; depois disso, cada cotação nova recalcula aqui mesmo.
  const portfolio = useMemo(() => {
    if (!wallet.data) return null;
    return hasQuotes ? valuatePortfolio(wallet.data.positions, market) : wallet.data;
  }, [wallet.data, market, hasQuotes]);

  async function remove(position) {
    if (!window.confirm(`Remover ${position.name} da carteira?`)) return;
    try {
      await api.delete(`/assets/${position.id}`);
      wallet.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  const positions = portfolio?.positions ?? [];
  const totals = portfolio?.totals;

  return (
    <>
      <header className="page-header">
        <h1>Carteira</h1>
        <button type="button" className="button primary" disabled={!hasQuotes} onClick={() => setEditing({})}>
          Adicionar ativo
        </button>
      </header>

      {(error || wallet.error) && <p className="form-error" role="alert">{error || wallet.error}</p>}

      {totals && positions.length > 0 && (
        <div className="grid thirds">
          <section className="net-worth">
            <h2>Valor total</h2>
            <LiveValue className="net-worth-value" value={totals.totalBrl} format={formatMoney} />
            <p className="net-worth-foot">Cotação das {formatTime(market.updatedAt)}</p>
          </section>
          <section className="card stat">
            <h2>Últimas 24h</h2>
            <p className={totals.change24hBrl >= 0 ? 'up' : 'down'}>{formatMoney(totals.change24hBrl)}</p>
            <small>{formatPercent(totals.change24hPercent)}</small>
          </section>
          <section className="card stat">
            <h2>Lucro sobre o investido</h2>
            {totals.profitPercent != null ? (
              <>
                <p className={totals.profitBrl >= 0 ? 'up' : 'down'}>{formatMoney(totals.profitBrl)}</p>
                <small>{formatPercent(totals.profitPercent)} sobre {formatMoney(totals.investedBrl)}</small>
              </>
            ) : (
              <small>Informe quanto pagou por cada ativo para ver o lucro.</small>
            )}
          </section>
        </div>
      )}

      <section className="card flush">
        {positions.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ativo</th>
                  <th className="num">Quantidade</th>
                  <th className="num">Preço</th>
                  <th className="num">24h</th>
                  <th className="num">Valor</th>
                  <th className="num">Lucro</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id}>
                    <td>
                      <b>{position.symbol}</b> <span className="muted">{position.name}</span>
                    </td>
                    <td className="num">{formatQuantity(position.quantity)}</td>
                    <td className="num"><LiveValue value={position.priceBrl} format={formatPrice} /></td>
                    <td className={`num ${position.change24h >= 0 ? 'up' : 'down'}`}>{formatPercent(position.change24h)}</td>
                    <td className="num">
                      {position.valueBrl != null ? <LiveValue value={position.valueBrl} format={formatMoney} /> : <span className="muted">Sem cotação</span>}
                    </td>
                    <td className={`num ${position.profitBrl == null ? 'muted' : position.profitBrl >= 0 ? 'up' : 'down'}`}>
                      {position.profitBrl != null ? `${formatMoney(position.profitBrl)} (${formatPercent(position.profitPercent)})` : '—'}
                    </td>
                    <td className="actions">
                      <button type="button" className="link-button" onClick={() => setEditing(position)}>Editar</button>
                      <button type="button" className="link-button danger" onClick={() => remove(position)}>Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !wallet.loading && (
            <p className="empty">
              Sua carteira está vazia. Adicione o que você tem de moeda estrangeira ou cripto para acompanhar o valor em reais.
            </p>
          )
        )}
      </section>

      {editing && (
        <AssetForm
          asset={editing}
          market={market}
          owned={positions}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); wallet.reload(); }}
        />
      )}
    </>
  );
}

function AssetForm({ asset, market, owned, onClose, onSaved }) {
  const isNew = !asset.id;
  const [choice, setChoice] = useState(''); // "crypto:bitcoin" ou "currency:USD"
  const [quantity, setQuantity] = useState(asset.quantity != null ? formatQuantity(asset.quantity) : '');
  const [invested, setInvested] = useState(asset.investedBrl != null ? String(asset.investedBrl).replace('.', ',') : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // só oferece o que ainda não está na carteira
  const ownedKeys = new Set(owned.map((position) => `${position.kind}:${position.code}`));
  const currencies = market.currencies.filter((currency) => !ownedKeys.has(`currency:${currency.code}`));
  const coins = market.crypto.filter((coin) => !ownedKeys.has(`crypto:${coin.id}`));

  async function submit(event) {
    event.preventDefault();
    const amount = parseNumber(quantity);
    if (!(amount > 0)) return setError('Informe uma quantidade maior que zero.');
    const cost = invested.trim() ? parseNumber(invested) : null;
    if (cost != null && !(cost >= 0)) return setError('Valor investido inválido.');

    setBusy(true);
    setError('');
    try {
      if (isNew) {
        const [kind, code] = choice.split(':');
        await api.post('/assets', { kind, code, quantity: amount, investedBrl: cost });
      } else {
        await api.put(`/assets/${asset.id}`, { quantity: amount, investedBrl: cost });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={isNew ? 'Adicionar ativo' : `Editar ${asset.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {isNew && (
          <label>
            Ativo
            <select value={choice} onChange={(event) => setChoice(event.target.value)} required autoFocus>
              <option value="" disabled>Escolha um ativo</option>
              <optgroup label="Moedas">
                {currencies.map((currency) => <option key={currency.code} value={`currency:${currency.code}`}>{currency.name} ({currency.code})</option>)}
              </optgroup>
              <optgroup label="Criptomoedas">
                {coins.map((coin) => <option key={coin.id} value={`crypto:${coin.id}`}>{coin.name} ({coin.symbol})</option>)}
              </optgroup>
            </select>
            <small>Estão disponíveis as moedas acompanhadas e as 10 maiores criptomoedas do momento.</small>
          </label>
        )}
        <div className="form-row">
          <label>
            Quantidade
            <input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" placeholder="0,01" required autoFocus={!isNew} />
          </label>
          <label>
            Total pago (R$), opcional
            <input value={invested} onChange={(event) => setInvested(event.target.value)} inputMode="decimal" placeholder="0,00" />
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="button" onClick={onClose}>Cancelar</button>
          <button className="button primary" disabled={busy}>Salvar ativo</button>
        </footer>
      </form>
    </Modal>
  );
}
