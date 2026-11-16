import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "./AuthContext";
import { LOGIN_PATH } from "../routes";

/** Renders its children only for a logged-in user; otherwise redirects to the login page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUser, isCheckingSession } = useAuth();

  if (isCheckingSession) {
    return <p className="loading">Loading…</p>;
  }

  if (!currentUser) {
    return <Navigate to={LOGIN_PATH} replace />;
  }

  return children;
}
