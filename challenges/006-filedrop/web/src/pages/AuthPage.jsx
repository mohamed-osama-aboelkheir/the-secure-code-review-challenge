import { useState } from 'react';
import { api } from '../api.js';

const EMPTY_FORM = { username: '', email: '', password: '' };

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = isRegister
        ? await api.register(form)
        : await api.login({ username: form.username, password: form.password });
      onAuthenticated(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-pitch">
        <div className="brand brand--large">
          <span className="brand-mark" aria-hidden="true">◈</span>
          <span>FileDrop</span>
        </div>
        <h1>Your files, wherever you are.</h1>
        <p>
          Drop a file from any device and pick it up from the next one. Every account gets its own
          private storage area — nothing is shared unless you send it yourself.
        </p>
        <ul className="pitch-list">
          <li>100 MB of storage per account</li>
          <li>Uploads up to 10 MB per file</li>
          <li>Downloads served straight back to you</li>
        </ul>
      </section>

      <section className="auth-card">
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isRegister}
            className={!isRegister ? 'tab tab--active' : 'tab'}
            onClick={() => switchMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isRegister}
            className={isRegister ? 'tab tab--active' : 'tab'}
            onClick={() => switchMode('register')}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Username</span>
            <input
              name="username"
              value={form.username}
              onChange={update('username')}
              autoComplete="username"
              required
            />
          </label>

          {isRegister && (
            <label className="field">
              <span>Email</span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={update('email')}
                autoComplete="email"
                required
              />
            </label>
          )}

          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={update('password')}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
            />
          </label>

          {error && <p className="alert alert--error">{error}</p>}

          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="hint">
          Demo account: <code>demo</code> / <code>demo12345</code>
        </p>
      </section>
    </div>
  );
}
