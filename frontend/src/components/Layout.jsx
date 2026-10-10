import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Ticker from './Ticker';

const LINKS = [
  ['/', 'Visão geral'],
  ['/lancamentos', 'Lançamentos'],
  ['/orcamentos', 'Orçamentos'],
  ['/carteira', 'Carteira'],
  ['/mercado', 'Mercado'],
  ['/categorias', 'Categorias'],
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <p className="brand">
          <svg viewBox="0 0 32 20" aria-hidden="true">
            <path d="M1 12h6l3-9 6 15 3-10 2 4h10" />
          </svg>
          FinPulse
        </p>
        <nav aria-label="Principal">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <span title={user.email}>{user.name}</span>
          <button type="button" className="link-button" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>
      <div className="content">
        <Ticker />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
