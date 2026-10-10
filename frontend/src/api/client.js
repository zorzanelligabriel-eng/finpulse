const TOKEN_KEY = 'finpulse.token';

// Endereço do back-end quando ele fica em outro domínio (produção).
// Vazio em desenvolvimento: os caminhos relativos passam pelo proxy do Vite.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => (token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY));

// Avisa o AuthContext quando a API responde 401 (token expirado), para deslogar.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => (onUnauthorized = handler);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor. Confira se a API está rodando.');
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // 401 fora do login significa sessão expirada
    if (response.status === 401 && token && !path.startsWith('/auth/login')) onUnauthorized();
    throw new ApiError(response.status, data?.error || 'Algo deu errado. Tente novamente.');
  }
  return data;
}

// Monta "?a=1&b=2" ignorando filtros vazios.
export function toQuery(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== '' && value != null);
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};
