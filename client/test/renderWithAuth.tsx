import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../src/auth/AuthContext";
import { AppRoutes } from "../src/AppRoutes";

/** Renders the real app routes at the given path. Tests mock the API modules, not components. */
export function renderAppAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
}

export const ALICE = {
  id: "user-alice",
  username: "alice",
  displayName: "Alice",
};
