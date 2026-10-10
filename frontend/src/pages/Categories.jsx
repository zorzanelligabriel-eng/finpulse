import { useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../utils/useFetch';
import Modal from '../components/Modal';

const COLORS = ['#0E7C86', '#1F8A4C', '#2B6CB0', '#6E4FA3', '#D1478A', '#C2362F', '#B5651D', '#E0A82E', '#5B6B6D'];
const TYPE_TITLE = { expense: 'Despesas', income: 'Receitas' };

export default function Categories() {
  const categories = useFetch('/categories');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  async function remove(category) {
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) return;
    setError('');
    try {
      await api.delete(`/categories/${category.id}`);
      categories.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Categorias</h1>
        <button type="button" className="button primary" onClick={() => setEditing({ type: 'expense' })}>
          Nova categoria
        </button>
      </header>

      {(error || categories.error) && <p className="form-error" role="alert">{error || categories.error}</p>}

      <div className="grid halves">
        {['expense', 'income'].map((type) => (
          <section className="card flush" key={type}>
            <h2 className="card-title">{TYPE_TITLE[type]}</h2>
            <ul className="category-list">
              {(categories.data ?? []).filter((category) => category.type === type).map((category) => (
                <li key={category.id}>
                  <i style={{ background: category.color }} />
                  <span>{category.name}</span>
                  <small className="muted">
                    {category.transactionCount} {category.transactionCount === 1 ? 'lançamento' : 'lançamentos'}
                  </small>
                  <button type="button" className="link-button" onClick={() => setEditing(category)}>Editar</button>
                  <button
                    type="button"
                    className="link-button danger"
                    disabled={category.transactionCount > 0}
                    title={category.transactionCount > 0 ? 'Categorias com lançamentos não podem ser excluídas' : undefined}
                    onClick={() => remove(category)}
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {editing && (
        <CategoryForm category={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); categories.reload(); }} />
      )}
    </>
  );
}

function CategoryForm({ category, onClose, onSaved }) {
  const isNew = !category.id;
  const [form, setForm] = useState({ name: category.name ?? '', type: category.type, color: category.color ?? COLORS[0] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isNew) await api.post('/categories', form);
      else await api.put(`/categories/${category.id}`, { name: form.name, color: form.color });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={isNew ? 'Nova categoria' : 'Editar categoria'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Nome
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={40} required autoFocus />
        </label>
        {isNew && (
          <label>
            Tipo
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </label>
        )}
        <fieldset className="swatches">
          <legend>Cor</legend>
          {COLORS.map((color) => (
            <label key={color} title={color}>
              <input type="radio" name="color" value={color} checked={form.color.toUpperCase() === color} onChange={() => setForm({ ...form, color })} />
              <i style={{ background: color }} />
              <span className="sr-only">{color}</span>
            </label>
          ))}
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="button" onClick={onClose}>Cancelar</button>
          <button className="button primary" disabled={busy}>Salvar categoria</button>
        </footer>
      </form>
    </Modal>
  );
}
