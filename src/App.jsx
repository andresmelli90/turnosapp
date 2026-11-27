import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PublicBookingPage } from "./pages/public/PublicBookingPage";
import { LoginPage } from "./pages/admin/LoginPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { SettingsPage } from "./pages/admin/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<DashboardPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
        <Route path="/:slug" element={<PublicBookingPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}