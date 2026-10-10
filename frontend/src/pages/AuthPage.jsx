import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      // ao logar, o App troca sozinho para as telas internas
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-pitch">
        <p className="brand">
          <svg viewBox="0 0 32 20" aria-hidden="true">
            <path d="M1 12h6l3-9 6 15 3-10 2 4h10" />
          </svg>
          FinPulse
        </p>
        <h1>Suas contas e seus ativos no mesmo lugar, com o preço de agora.</h1>
        <p>
          Registre receitas e despesas, defina um teto de gastos por categoria e acompanhe quanto valem seus dólares e
          criptomoedas enquanto o mercado se move.
        </p>
      </section>

      <form className="auth-form" onSubmit={submit}>
        <h2>{isLogin ? 'Entrar' : 'Criar conta'}</h2>
        {!isLogin && (
          <label>
            Nome
            <input name="name" value={form.name} onChange={change} autoComplete="name" required minLength={2} />
          </label>
        )}
        <label>
          E-mail
          <input type="email" name="email" value={form.email} onChange={change} autoComplete="email" required />
        </label>
        <label>
          Senha
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={change}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            required
            minLength={isLogin ? undefined : 8}
          />
          {!isLogin && <small>Pelo menos 8 caracteres.</small>}
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary" disabled={busy}>
          {isLogin ? 'Entrar' : 'Criar conta'}
        </button>
        <p className="auth-switch">
          {isLogin ? (
            <>Ainda não tem conta? <Link to="/criar-conta">Criar conta</Link></>
          ) : (
            <>Já tem conta? <Link to="/entrar">Entrar</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
