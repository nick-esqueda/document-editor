import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { LOGIN_PATH } from "../routes";
import { BrandMark } from "./BrandMark";

const LOGOUT_FAILED_MESSAGE =
  "Couldn't log out. Check your connection and try again.";

export function AppHeader() {
  const { currentUser, logOut } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogOut() {
    setLogoutError(null);

    try {
      await logOut();
      navigate(LOGIN_PATH, { replace: true });
    } catch {
      setLogoutError(LOGOUT_FAILED_MESSAGE);
    }
  }

  const displayName = currentUser?.displayName ?? "";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="app-header">
      <BrandMark />
      <div className="spacer" />
      {logoutError && (
        <p className="header-error" role="alert">
          {logoutError}
        </p>
      )}
      <div className="current-user">
        <span className="avatar" aria-hidden="true">
          {initial}
        </span>
        <span>{displayName}</span>
      </div>
      <button className="button" type="button" onClick={handleLogOut}>
        Log out
      </button>
    </header>
  );
}
