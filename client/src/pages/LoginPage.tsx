import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/httpClient";
import { BrandMark } from "../components/BrandMark";
import { HOME_PATH } from "../routes";

const DEMO_USERS_HINT = "Demo users: alice, bob, carol";
const UNEXPECTED_ERROR_MESSAGE = "Couldn't log in. Please try again.";

export function LoginPage() {
  const { currentUser, logIn } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (currentUser) {
    return <Navigate to={HOME_PATH} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await logIn({ username, password });
      navigate(HOME_PATH, { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : UNEXPECTED_ERROR_MESSAGE,
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <BrandMark />
      <form className="login-card" onSubmit={handleSubmit}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {errorMessage && (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}

        <button
          className="button primary"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      {import.meta.env.DEV && <p className="hint">{DEMO_USERS_HINT}</p>}
    </main>
  );
}
