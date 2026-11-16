import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { LoginRequest, PublicUser } from "@doc-editor/shared";
import { fetchCurrentUser, logIn, logOut } from "../api/authApi";

interface AuthState {
  /** The logged-in user, or null when logged out. */
  currentUser: PublicUser | null;
  /** True until the first "who am I?" check finishes. */
  isCheckingSession: boolean;
  logIn: (credentials: LoginRequest) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Provider pattern: wrap the app once, then read auth state anywhere with useAuth(). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  // Set once the user logs in or out, so a slower initial session check can't overwrite that.
  const hasUserActedRef = useRef(false);

  useEffect(() => {
    const applyInitialSession = (user: PublicUser | null) => {
      if (!hasUserActedRef.current) {
        setCurrentUser(user);
      }
    };

    fetchCurrentUser()
      .then(applyInitialSession)
      .catch(() => applyInitialSession(null))
      .finally(() => setIsCheckingSession(false));
  }, []);

  const handleLogIn = useCallback(async (credentials: LoginRequest) => {
    const user = await logIn(credentials);
    hasUserActedRef.current = true;
    setCurrentUser(user);
  }, []);

  const handleLogOut = useCallback(async () => {
    await logOut();
    hasUserActedRef.current = true;
    setCurrentUser(null);
  }, []);

  const authState = useMemo(
    () => ({
      currentUser,
      isCheckingSession,
      logIn: handleLogIn,
      logOut: handleLogOut,
    }),
    [currentUser, isCheckingSession, handleLogIn, handleLogOut],
  );

  return (
    <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const authState = useContext(AuthContext);

  if (!authState) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return authState;
}
