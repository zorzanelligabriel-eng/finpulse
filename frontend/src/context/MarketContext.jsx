import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { API_URL } from '../api/client';
import { useAuth } from './AuthContext';

const EMPTY = { status: 'loading', updatedAt: null, crypto: [], currencies: [] };
const HISTORY_SIZE = 40;

const MarketContext = createContext({ market: EMPTY, connected: false, history: {} });

/**
 * Mantém um WebSocket aberto com o back-end enquanto o usuário está logado.
 * Cada mensagem traz todas as cotações; qualquer tela lê com useMarket().
 */
export function MarketProvider({ children }) {
  const { token } = useAuth();
  const [market, setMarket] = useState(EMPTY);
  const [connected, setConnected] = useState(false);
  // últimos preços recebidos de cada ativo, para os minigráficos
  const [history, setHistory] = useState({});
  const retryRef = useRef(0);

  useEffect(() => {
    if (!token) {
      setMarket(EMPTY);
      setHistory({});
      return undefined;
    }

    let socket;
    let timer;
    let closedOnPurpose = false;

    const connect = () => {
      // http -> ws e https -> wss; sem VITE_API_URL, usa o próprio endereço da página
      const base = (API_URL || window.location.origin).replace(/^http/, 'ws');
      socket = new WebSocket(`${base}/ws?token=${encodeURIComponent(token)}`);

      socket.onopen = () => {
        retryRef.current = 0;
        setConnected(true);
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type !== 'market') return;
        setMarket(message.data);
        setHistory((previous) => {
          const next = { ...previous };
          const push = (key, price) => {
            next[key] = [...(previous[key] ?? []), price].slice(-HISTORY_SIZE);
          };
          message.data.crypto.forEach((coin) => push(`crypto:${coin.id}`, coin.priceBrl));
          message.data.currencies.forEach((currency) => push(`currency:${currency.code}`, currency.priceBrl));
          return next;
        });
      };

      socket.onclose = () => {
        setConnected(false);
        if (closedOnPurpose) return;
        // reconecta esperando cada vez mais: 1s, 2s, 4s... até 30s
        const delay = Math.min(30_000, 1000 * 2 ** retryRef.current);
        retryRef.current += 1;
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      closedOnPurpose = true;
      clearTimeout(timer);
      socket.close();
    };
  }, [token]);

  return <MarketContext.Provider value={{ market, connected, history }}>{children}</MarketContext.Provider>;
}

export const useMarket = () => useContext(MarketContext);
