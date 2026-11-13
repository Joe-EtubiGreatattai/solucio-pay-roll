import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

// Loads data from the API. Returns { data, error, loading, reload, setData }.
export default function useFetch(path, { initial = null } = {}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const d = await api(path);
      setData(d);
      setError('');
      return d;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
