import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getToken);
  // enquanto confere o token salvo, não sabemos se há alguém logado
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((data) => setUser(data.user))
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout]);

  const startSession = useCallback((data) => {
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      logout,
      login: async (email, password) => startSession(await api.post('/auth/login', { email, password })),
      register: async (name, email, password) => startSession(await api.post('/auth/register', { name, email, password })),
    }),
    [user, token, loading, logout, startSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
