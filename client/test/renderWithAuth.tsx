import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "../src/auth/AuthContext";
import { RequireAuth } from "../src/auth/RequireAuth";
import { HomePage } from "../src/pages/HomePage";
import { LoginPage } from "../src/pages/LoginPage";
import { HOME_PATH, LOGIN_PATH } from "../src/routes";

/** Renders the real routes at the given path. Tests mock the API module, not the components. */
export function renderAppAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={LOGIN_PATH} element={<LoginPage />} />
          <Route
            path={HOME_PATH}
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

export const ALICE = {
  id: "user-alice",
  username: "alice",
  displayName: "Alice",
};
