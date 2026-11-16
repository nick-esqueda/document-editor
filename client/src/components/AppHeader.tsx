import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { LOGIN_PATH } from "../routes";
import { BrandMark } from "./BrandMark";

export function AppHeader() {
  const { currentUser, logOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogOut() {
    await logOut();
    navigate(LOGIN_PATH, { replace: true });
  }

  const displayName = currentUser?.displayName ?? "";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="app-header">
      <BrandMark />
      <div className="spacer" />
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
