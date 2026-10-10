import { useState } from 'react';
import { api, toQuery } from '../api/client';
import { useFetch } from '../utils/useFetch';
import { formatDate, formatMoney, parseNumber, today } from '../utils/format';
import Modal from '../components/Modal';

const EMPTY_FILTERS = { q: '', type: '', categoryId: '', from: '', to: '' };

export default function Transactions() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null = fechado; {} = novo; {id...} = edição
  const [error, setError] = useState('');

  const categories = useFetch('/categories');
  const list = useFetch(`/transactions${toQuery({ ...filters, page, limit: 10 })}`);

  // qualquer mudança de filtro volta para a primeira página
  const changeFilter = (event) => {
    setFilters({ ...filters, [event.target.name]: event.target.value });
    setPage(1);
  };

  async function remove(transaction) {
    if (!window.confirm(`Excluir "${transaction.description}"?`)) return;
    try {
      await api.delete(`/transactions/${transaction.id}`);
      // se era o último item da página, volta uma
      if (list.data.data.length === 1 && page > 1) setPage(page - 1);
      else list.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  const rows = list.data?.data ?? [];
  const pagination = list.data?.pagination;
  const totals = list.data?.totals;
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <header className="page-header">
        <h1>Lançamentos</h1>
        <button type="button" className="button primary" onClick={() => setEditing({})}>
          Novo lançamento
        </button>
      </header>

      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <label className="grow">
          Buscar
          <input name="q" value={filters.q} onChange={changeFilter} placeholder="Descrição" />
        </label>
        <label>
          Tipo
          <select name="type" value={filters.type} onChange={changeFilter}>
            <option value="">Todos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </select>
        </label>
        <label>
          Categoria
          <select name="categoryId" value={filters.categoryId} onChange={changeFilter}>
            <option value="">Todas</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          De
          <input type="date" name="from" value={filters.from} onChange={changeFilter} />
        </label>
        <label>
          Até
          <input type="date" name="to" value={filters.to} onChange={changeFilter} />
        </label>
        {hasFilters && (
          <button type="button" className="link-button" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>
            Limpar filtros
          </button>
        )}
      </form>

      {(error || list.error) && <p className="form-error" role="alert">{error || list.error}</p>}

      <section className="card flush">
        {totals && (
          <p className="table-summary">
            <span>{pagination.total} {pagination.total === 1 ? 'lançamento' : 'lançamentos'}</span>
            <span>Receitas <b className="up">{formatMoney(totals.income)}</b></span>
            <span>Despesas <b className="down">{formatMoney(totals.expense)}</b></span>
            <span>Saldo <b>{formatMoney(totals.balance)}</b></span>
          </p>
        )}

        {rows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th className="num">Valor</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="nowrap">{formatDate(transaction.date)}</td>
                    <td>{transaction.description}</td>
                    <td>
                      <span className="tag">
                        <i style={{ background: transaction.categoryColor }} />
                        {transaction.categoryName}
                      </span>
                    </td>
                    <td className={`num ${transaction.type === 'income' ? 'up' : 'down'}`}>
                      {transaction.type === 'income' ? '+' : '−'} {formatMoney(transaction.amount)}
                    </td>
                    <td className="actions">
                      <button type="button" className="link-button" onClick={() => setEditing(transaction)}>Editar</button>
                      <button type="button" className="link-button danger" onClick={() => remove(transaction)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !list.loading && (
            <p className="empty">
              {hasFilters ? 'Nenhum lançamento com esses filtros.' : 'Nenhum lançamento ainda. Comece registrando uma receita ou despesa.'}
            </p>
          )
        )}

        {pagination && pagination.totalPages > 1 && (
          <nav className="pagination" aria-label="Paginação">
            <button type="button" className="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
            <span>Página {pagination.page} de {pagination.totalPages}</span>
            <button type="button" className="button" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Próxima</button>
          </nav>
        )}
      </section>

      {editing && (
        <TransactionForm
          transaction={editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); list.reload(); }}
        />
      )}
    </>
  );
}

function TransactionForm({ transaction, categories, onClose, onSaved }) {
  const isNew = !transaction.id;
  const [form, setForm] = useState({
    description: transaction.description ?? '',
    amount: transaction.amount != null ? String(transaction.amount).replace('.', ',') : '',
    date: transaction.date ?? today(),
    categoryId: transaction.categoryId ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    const amount = parseNumber(form.amount);
    if (!(amount > 0)) return setError('Informe um valor maior que zero.');

    setBusy(true);
    setError('');
    const body = { description: form.description, amount, date: form.date, categoryId: Number(form.categoryId) };
    try {
      if (isNew) await api.post('/transactions', body);
      else await api.put(`/transactions/${transaction.id}`, body);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const byType = (type) => categories.filter((category) => category.type === type);

  return (
    <Modal title={isNew ? 'Novo lançamento' : 'Editar lançamento'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Descrição
          <input name="description" value={form.description} onChange={change} maxLength={120} required autoFocus />
        </label>
        <div className="form-row">
          <label>
            Valor (R$)
            <input name="amount" value={form.amount} onChange={change} inputMode="decimal" placeholder="0,00" required />
          </label>
          <label>
            Data
            <input type="date" name="date" value={form.date} onChange={change} required />
          </label>
        </div>
        <label>
          Categoria
          <select name="categoryId" value={form.categoryId} onChange={change} required>
            <option value="" disabled>Escolha uma categoria</option>
            <optgroup label="Despesas">
              {byType('expense').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </optgroup>
            <optgroup label="Receitas">
              {byType('income').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </optgroup>
          </select>
          <small>A categoria define se o lançamento é receita ou despesa.</small>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="button" onClick={onClose}>Cancelar</button>
          <button className="button primary" disabled={busy}>Salvar lançamento</button>
        </footer>
      </form>
    </Modal>
  );
}
