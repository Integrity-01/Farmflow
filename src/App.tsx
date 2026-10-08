import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { AppGuard, GuestGuard } from '@/components/auth/guards';
import { Toaster } from '@/components/ui/Toaster';
import { registerServiceWorker } from '@/pwa/registerSW';
import { bootstrapAuth } from '@/services/auth';
import { Analytics } from '@/pages/Analytics';
import { Assistant } from '@/pages/Assistant';
import { Dashboard } from '@/pages/Dashboard';
import { DesignSystem } from '@/pages/DesignSystem';
import { Farms } from '@/pages/Farms';
import { History } from '@/pages/History';
import { Inventory } from '@/pages/Inventory';
import { MyTasks } from '@/pages/MyTasks';
import { NotFound } from '@/pages/NotFound';
import { Notifications } from '@/pages/Notifications';
import { Profile } from '@/pages/Profile';
import { RecurringTasks } from '@/pages/RecurringTasks';
import { Reports } from '@/pages/Reports';
import { Settings } from '@/pages/Settings';
import { Tasks } from '@/pages/Tasks';
import { Weather } from '@/pages/Weather';
import { Workers } from '@/pages/Workers';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { ResetPassword } from '@/pages/auth/ResetPassword';

registerServiceWorker();

export default function App() {
  useEffect(() => {
    void bootstrapAuth();
  }, []);

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestGuard>
              <Login />
            </GuestGuard>
          }
        />
        <Route
          path="/register"
          element={
            <GuestGuard>
              <Register />
            </GuestGuard>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestGuard>
              <ForgotPassword />
            </GuestGuard>
          }
        />
        <Route
          path="/reset-password"
          element={
            <GuestGuard>
              <ResetPassword />
            </GuestGuard>
          }
        />

        <Route
          element={
            <AppGuard>
              <AppShell />
            </AppGuard>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/my-tasks" element={<MyTasks />} />
          <Route path="/recurring-tasks" element={<RecurringTasks />} />
          <Route path="/farms" element={<Farms />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/workers" element={<Workers />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/history" element={<History />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          {import.meta.env.DEV ? (
            <Route path="/design-system" element={<DesignSystem />} />
          ) : null}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}