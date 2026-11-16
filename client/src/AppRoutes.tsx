import { Navigate, Route, Routes } from "react-router";
import { RequireAuth } from "./auth/RequireAuth";
import { DocumentEditorPage } from "./pages/DocumentEditorPage";
import { DocumentListPage } from "./pages/DocumentListPage";
import { LoginPage } from "./pages/LoginPage";
import { DOCUMENT_PATH, HOME_PATH, LOGIN_PATH } from "./routes";

/** Every screen in the app. Kept apart from the router so tests can render it in memory. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={LOGIN_PATH} element={<LoginPage />} />
      <Route
        path={HOME_PATH}
        element={
          <RequireAuth>
            <DocumentListPage />
          </RequireAuth>
        }
      />
      <Route
        path={DOCUMENT_PATH}
        element={
          <RequireAuth>
            <DocumentEditorPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
    </Routes>
  );
}
