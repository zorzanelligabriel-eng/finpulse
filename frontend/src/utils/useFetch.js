import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

// Busca `path` na API e refaz a busca quando o caminho muda. reload() força nova busca.
export function useFetch(path) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    api
      .get(path)
      .then((data) => !cancelled && setState({ data, loading: false, error: '' }))
      .catch((err) => !cancelled && setState({ data: null, loading: false, error: err.message }));
    // se o caminho mudar antes da resposta chegar, a resposta antiga é ignorada
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
