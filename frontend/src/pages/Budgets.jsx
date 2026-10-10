import { useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../utils/useFetch';
import { currentMonth, formatMoney, formatMonth, parseNumber } from '../utils/format';
import MonthPicker from '../components/MonthPicker';
import Modal from '../components/Modal';

const STATUS_TEXT = { ok: 'Dentro do limite', warning: 'Perto do limite', over: 'Limite estourado' };

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const budgets = useFetch(`/budgets?month=${month}`);
  const categories = useFetch('/categories');

  const expenseCategories = (categories.data ?? []).filter((category) => category.type === 'expense');
  const used = new Set((budgets.data ?? []).map((budget) => budget.categoryId));
  const available = expenseCategories.filter((category) => !used.has(category.id));

  async function remove(budget) {
    if (!window.confirm(`Remover o orçamento de ${budget.categoryName}?`)) return;
    try {
      await api.delete(`/budgets/${budget.id}`);
      budgets.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Orçamentos</h1>
        <MonthPicker month={month} onChange={setMonth} />
        <button type="button" className="button primary" disabled={available.length === 0} onClick={() => setEditing({})}>
          Definir orçamento
        </button>
      </header>

      {(error || budgets.error) && <p className="form-error" role="alert">{error || budgets.error}</p>}

      {budgets.data?.length === 0 && (
        <p className="empty card">
          Nenhum orçamento em {formatMonth(month)}. Defina um teto de gastos por categoria e acompanhe quanto ainda pode gastar.
        </p>
      )}

      <div className="budget-list">
        {(budgets.data ?? []).map((budget) => (
          <section className={`card budget is-${budget.status}`} key={budget.id}>
            <header>
              <h2>
                <i style={{ background: budget.categoryColor }} />
                {budget.categoryName}
              </h2>
              <span className="budget-status">{STATUS_TEXT[budget.status]}</span>
            </header>
            <div
              className="meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(budget.percent, 100)}
              aria-label={`${budget.percent}% do orçamento de ${budget.categoryName} usado`}
            >
              <span style={{ width: `${Math.min(budget.percent, 100)}%` }} />
            </div>
            <p className="budget-numbers">
              <span><b>{formatMoney(budget.spent)}</b> de {formatMoney(budget.limit)}</span>
              <span>
                {budget.remaining >= 0 ? `Restam ${formatMoney(budget.remaining)}` : `${formatMoney(-budget.remaining)} acima`}
              </span>
            </p>
            <footer>
              <button type="button" className="link-button" onClick={() => setEditing(budget)}>Alterar limite</button>
              <button type="button" className="link-button danger" onClick={() => remove(budget)}>Remover</button>
            </footer>
          </section>
        ))}
      </div>

      {editing && (
        <BudgetForm
          budget={editing}
          month={month}
          categories={editing.id ? expenseCategories : available}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); budgets.reload(); }}
        />
      )}
    </>
  );
}

function BudgetForm({ budget, month, categories, onClose, onSaved }) {
  const isNew = !budget.id;
  const [categoryId, setCategoryId] = useState(budget.categoryId ?? '');
  const [limit, setLimit] = useState(budget.limit != null ? String(budget.limit).replace('.', ',') : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const value = parseNumber(limit);
    if (!(value > 0)) return setError('Informe um limite maior que zero.');
    setBusy(true);
    try {
      await api.put('/budgets', { categoryId: Number(categoryId), month, limit: value });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={isNew ? `Orçamento de ${formatMonth(month)}` : `Limite de ${budget.categoryName}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {isNew && (
          <label>
            Categoria
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required autoFocus>
              <option value="" disabled>Escolha uma categoria</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        )}
        <label>
          Limite no mês (R$)
          <input value={limit} onChange={(event) => setLimit(event.target.value)} inputMode="decimal" placeholder="0,00" required autoFocus={!isNew} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="button" onClick={onClose}>Cancelar</button>
          <button className="button primary" disabled={busy}>Salvar orçamento</button>
        </footer>
      </form>
    </Modal>
  );
}
