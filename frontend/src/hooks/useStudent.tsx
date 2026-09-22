import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, type Student } from "../api/client.ts";

// No accounts yet, so the profile id lives in localStorage.
const STORAGE_KEY = "gradtrellis.studentId";

interface StudentState {
  student: Student | null;
  loading: boolean;
  error: string | null;
  setStudent: (s: Student) => void;
  refresh: () => Promise<void>;
}

const StudentContext = createContext<StudentState | null>(null);

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode etc.
  }
}

export function StudentProvider({ children }: { children: ReactNode }) {
  const [student, setStudentState] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    try {
      setStudentState(await api.getStudent(id));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        writeStoredId(null);
        setStudentState(null);
      } else {
        setError(err instanceof Error ? err.message : "couldn't load your record");
      }
    }
  }, []);

  useEffect(() => {
    const id = readStoredId();
    if (!id) {
      setLoading(false);
      return;
    }
    void load(id).finally(() => setLoading(false));
  }, [load]);

  const setStudent = useCallback((s: Student) => {
    writeStoredId(s.id);
    setStudentState(s);
  }, []);

  const refresh = useCallback(async () => {
    if (student) await load(student.id);
  }, [student, load]);

  return <StudentContext value={{ student, loading, error, setStudent, refresh }}>{children}</StudentContext>;
}

export function useStudent(): StudentState {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent must be used inside StudentProvider");
  return ctx;
}
