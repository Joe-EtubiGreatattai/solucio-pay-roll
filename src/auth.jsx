import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { user, company }
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(setSession)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = (data) => {
    setToken(data.token);
    setSession({ user: data.user, company: data.company });
  };
  const signOut = () => {
    setToken(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ ...session, loading, signIn, signOut, setSession }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const canManage = (user) => ['OWNER', 'ADMIN'].includes(user?.role);
