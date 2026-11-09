import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DataProvider } from './data/store';
import { AuthProvider, useAuth } from './data/session';
import { ToastProvider } from './components/toast';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { AnimalListPage } from './pages/animals/AnimalListPage';
import { AnimalFormPage } from './pages/animals/AnimalFormPage';
import { AnimalProfilePage } from './pages/animals/AnimalProfilePage';
import { HealthPage } from './pages/animals/HealthPage';
import { BookingListPage } from './pages/boarding/BookingListPage';
import { BookingNewPage } from './pages/boarding/BookingNewPage';
import { BookingDetailPage } from './pages/boarding/BookingDetailPage';
import { ClientListPage } from './pages/clients/ClientListPage';
import { ClientFormPage } from './pages/clients/ClientFormPage';
import { ClientProfilePage } from './pages/clients/ClientProfilePage';
import { PetFormPage } from './pages/clients/PetFormPage';
import { PetProfilePage } from './pages/clients/PetProfilePage';
import { AgendaPage } from './pages/AgendaPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { MedicationsPage } from './pages/MedicationsPage';
import { TasksPage } from './pages/TasksPage';
import { AlertsPage } from './pages/AlertsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { userId, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Splash />;
  if (!userId) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/** Tela mínima enquanto a sessão salva é recuperada. */
function Splash() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }} aria-busy="true" aria-label="Carregando">
      <img src="/brand/lunaar-logo-compact.png" alt="LUNAAR" width={160} style={{ opacity: 0.9 }} />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route
            element={
              <RequireAuth>
                <DataProvider>
                  <AppShell />
                </DataProvider>
              </RequireAuth>
            }
          >
              <Route index element={<DashboardPage />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="animais" element={<AnimalListPage />} />
              <Route path="animais/novo" element={<AnimalFormPage />} />
              <Route path="animais/:id" element={<AnimalProfilePage />} />
              <Route path="animais/:id/editar" element={<AnimalFormPage />} />
              <Route path="saude" element={<HealthPage />} />
              <Route path="medicamentos" element={<MedicationsPage />} />
              <Route path="tarefas" element={<TasksPage />} />
              <Route path="alertas" element={<AlertsPage />} />
              <Route path="hospedagem" element={<BookingListPage />} />
              <Route path="hospedagem/nova" element={<BookingNewPage />} />
              <Route path="hospedagem/:id" element={<BookingDetailPage />} />
              <Route path="clientes" element={<ClientListPage />} />
              <Route path="clientes/novo" element={<ClientFormPage />} />
              <Route path="clientes/:id" element={<ClientProfilePage />} />
              <Route path="clientes/:id/editar" element={<ClientFormPage />} />
              <Route path="clientes/:clientId/pets/novo" element={<PetFormPage />} />
              <Route path="pets/:id" element={<PetProfilePage />} />
              <Route path="pets/:id/editar" element={<PetFormPage />} />
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
