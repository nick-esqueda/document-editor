import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { HOME_PATH, LOGIN_PATH } from "./routes";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
          <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
