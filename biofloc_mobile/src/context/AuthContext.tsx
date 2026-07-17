import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authService } from '../services/auth.service';
import { useRouter } from 'expo-router';

interface AuthContextData {
  token: string | null;
  username: string | null;
  isLoading: boolean;
  login: (u: string, p: string) => Promise<void>;
  register: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  // Track whether initial bootstrap is done so we only redirect once on startup
  const bootstrapped = useRef(false);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const t = await authService.getToken();
        const u = await authService.getUsername();
        if (t) {
          setToken(t);
          setUsername(u);
          // Already logged in — redirect to dashboard once on app start
          router.replace('/(dashboard)/kolam');
        }
      } catch (e) {
        console.error('Failed to load token', e);
      } finally {
        setIsLoading(false);
        bootstrapped.current = true;
      }
    };

    checkToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (u: string, p: string) => {
    const res = await authService.login(u, p);
    setToken(res.access_token);
    setUsername(u);
    // Navigate imperatively after successful login — no reactive effect needed
    router.replace('/(dashboard)/kolam');
  };

  const register = async (u: string, p: string) => {
    await authService.register(u, p);
    // auto-login after register
    const res = await authService.login(u, p);
    setToken(res.access_token);
    setUsername(u);
    router.replace('/(dashboard)/kolam');
  };

  const logout = async () => {
    await authService.logout();
    setToken(null);
    setUsername(null);
    router.replace('/');
  };

  return (
    <AuthContext.Provider value={{ token, username, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Call this hook at the top of any screen that requires authentication.
 * It redirects to the login page if no token is found.
 * Uses a one-shot check so it never causes repeated re-renders.
 */
export function useProtectedRoute() {
  const { token, isLoading } = useContext(AuthContext);
  const router = useRouter();
  const checked = useRef(false);

  useEffect(() => {
    if (isLoading || checked.current) return;
    checked.current = true;
    if (!token) {
      router.replace('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);
}
