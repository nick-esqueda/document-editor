import { BrowserRouter } from "react-router";
import { AuthProvider } from "./auth/AuthContext";
import { AppRoutes } from "./AppRoutes";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
