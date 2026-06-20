"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { SectorId } from "@/lib/types";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  signInWithEmail,
  signOut,
  signUpWithShop,
} from "@/lib/supabase/auth-actions";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    shopName: string;
    phone?: string;
    sector: SectorId;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const supabase = createBrowserClient();
    if (!supabase) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      setUser(u);
    } catch {
      // Network/CORS blocks to Supabase should not break local demo mode.
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const supabase = createBrowserClient();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmail(email, password);
    await refresh();
  };

  const signUp = async (input: {
    email: string;
    password: string;
    shopName: string;
    phone?: string;
    sector: SectorId;
  }) => {
    await signUpWithShop(input);
    await refresh();
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      loading: false,
      signIn: async () => {},
      signUp: async () => {},
      logout: async () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
