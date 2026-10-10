import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Wallet from './pages/Wallet';
import Market from './pages/Market';
import Categories from './pages/Categories';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <p className="splash">Carregando…</p>;

  // Sem login, só existem as telas de entrar e criar conta.
  if (!user) {
    return (
      <Routes>
        <Route path="/entrar" element={<AuthPage mode="login" />} />
        <Route path="/criar-conta" element={<AuthPage mode="register" />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lancamentos" element={<Transactions />} />
        <Route path="/orcamentos" element={<Budgets />} />
        <Route path="/carteira" element={<Wallet />} />
        <Route path="/mercado" element={<Market />} />
        <Route path="/categorias" element={<Categories />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
