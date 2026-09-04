import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthScreen.css';

// Email + password gate shown when Supabase is configured and nobody is
// signed in. Email confirmation is disabled server-side, so signup works
// immediately.
export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    const action = mode === 'signin' ? signIn : signUp;
    const { error: authError } = await action(email.trim(), password);

    if (authError) {
      setError(authError.message);
      setBusy(false);
    }
    // On success the auth listener flips the app over; no navigation needed.
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-logo">Kanban</h1>
        <p className="auth-subtitle">
          {mode === 'signin'
            ? 'Sign in to your boards'
            : 'Create an account to get started'}
        </p>

        <label className="auth-label" htmlFor="auth-email">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          autoFocus
        />

        <label className="auth-label" htmlFor="auth-password">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          minLength={6}
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          className="btn-link auth-switch"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
          }}
        >
          {mode === 'signin'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
