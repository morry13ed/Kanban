import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { clearLocalState } from '../utils/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  // With no Supabase configured there is nothing to wait for.
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password) => supabase.auth.signUp({ email, password });

  // The local cache belongs to the account that was signed in; wipe it so the
  // next person at this browser doesn't inherit their boards.
  const signOut = async () => {
    await supabase.auth.signOut();
    clearLocalState();
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        enabled: Boolean(supabase),
        ready,
        session,
        user: session?.user ?? null,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
