import { useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '../../../shared/src/types';
import { ApiError, login, register } from '../api';

interface AuthProps {
  onDone: (user: User) => void;
}

export default function Auth({ onDone }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      if (password !== password2) {
        setError('Нууц үг таарахгүй байна. Дахин шалгана уу.');
        return;
      }
      if (!name.trim()) {
        setError('Нэрээ оруулна уу.');
        return;
      }
    }
    if (!username.trim() || !password) {
      setError('Хэрэглэгчийн нэр болон нууц үгээ оруулна уу.');
      return;
    }
    setBusy(true);
    try {
      const user = mode === 'login' ? await login(username.trim(), password) : await register(name.trim(), username.trim(), password);
      onDone(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1>{mode === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}</h1>
      </div>
      <div className="tabs">
        <button type="button" className={`tab${mode === 'login' ? ' active' : ''}`} onClick={() => setMode('login')}>
          Нэвтрэх
        </button>
        <button type="button" className={`tab${mode === 'register' ? ' active' : ''}`} onClick={() => setMode('register')}>
          Бүртгүүлэх
        </button>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="error">{error}</div>}
        {mode === 'register' && (
          <div className="field">
            <label className="label" htmlFor="auth-name">
              Нэр
            </label>
            <input
              id="auth-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="auth-username">
            Хэрэглэгчийн нэр
          </label>
          <input
            id="auth-username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="auth-password">
            Нууц үг
          </label>
          <input
            id="auth-password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>
        {mode === 'register' && (
          <div className="field">
            <label className="label" htmlFor="auth-password2">
              Нууц үг давтах
            </label>
            <input
              id="auth-password2"
              className="input"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Түр хүлээнэ үү...' : mode === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
        </button>
        {mode === 'register' && <p className="note">Анх бүртгүүлсэн хэрэглэгч админ болно.</p>}
      </form>
    </div>
  );
}
