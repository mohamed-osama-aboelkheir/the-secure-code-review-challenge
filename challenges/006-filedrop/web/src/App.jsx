import { useCallback, useEffect, useState } from 'react';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { api, getToken, setToken } from './api.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user: current }) => setUser(current))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const handleAuthenticated = useCallback(({ token, user: current }) => {
    setToken(token);
    setUser(current);
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  if (loading) {
    return (
      <div className="boot">
        <span className="spinner" aria-hidden="true" />
        <p>Loading your drop…</p>
      </div>
    );
  }

  return user
    ? <Dashboard user={user} onLogout={handleLogout} />
    : <AuthPage onAuthenticated={handleAuthenticated} />;
}
