import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, type Student, type User } from "../api/client.ts";

interface Session {
  user: User | null;
  // null until the user sets up their degree profile
  student: Student | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User) => Promise<void>;
  setStudent: (student: Student) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

// The login lives in an httpOnly cookie, so a reload or a new tab asks the server who we are.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUserState(me.user);
      setStudent(me.student);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUserState(null);
        setStudent(null);
      } else {
        setError(err instanceof Error ? err.message : "couldn't load your account");
      }
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  // after logging in or confirming: load their profile too
  const setUser = useCallback(
    async (u: User) => {
      setUserState(u);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUserState(null);
    setStudent(null);
  }, []);

  return <SessionContext value={{ user, student, loading, error, setUser, setStudent, refresh, logout }}>{children}</SessionContext>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
