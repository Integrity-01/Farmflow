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
import { Team } from '@/pages/Team';
import { Weather } from '@/pages/Weather';
import { Workers } from '@/pages/Workers';
import { AcceptInvitation } from '@/pages/auth/AcceptInvitation';
import { AdminLogin } from '@/pages/auth/AdminLogin';
import { EntryChoice } from '@/pages/auth/EntryChoice';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { AuthSplash } from '@/pages/auth/AuthSplash';
import { Login } from '@/pages/auth/Login';
import { NewOrganization } from '@/pages/auth/NewOrganization';
import { Register } from '@/pages/auth/Register';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { Splash } from '@/pages/auth/Splash';
import { Welcome } from '@/pages/auth/Welcome';
import { SystemGuard, SystemGuestGuard } from '@/components/system/guards';
import { SystemShell } from '@/components/system/SystemShell';
import { SystemLogin } from '@/pages/system/SystemLogin';
import { SystemForgotPassword } from '@/pages/system/SystemForgotPassword';
import { SystemResetPassword } from '@/pages/system/SystemResetPassword';
import { SystemChangePassword } from '@/pages/system/SystemChangePassword';
import { SystemOverview } from '@/pages/system/SystemOverview';
import { SystemOrganizations } from '@/pages/system/SystemOrganizations';
import { SystemOrganizationDetail } from '@/pages/system/SystemOrganizationDetail';
import { SystemUsers } from '@/pages/system/SystemUsers';
import { SystemUserDetail } from '@/pages/system/SystemUserDetail';
import { SystemAnalytics } from '@/pages/system/SystemAnalytics';
import { SystemAuditLogs } from '@/pages/system/SystemAuditLogs';
import { SystemHealth } from '@/pages/system/SystemHealth';
import { SystemAdministrators } from '@/pages/system/SystemAdministrators';
import { SystemSettings } from '@/pages/system/SystemSettings';

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
              <Splash />
            </GuestGuard>
          }
        />
        <Route
          path="/login/welcome"
          element={
            <GuestGuard>
              <Welcome />
            </GuestGuard>
          }
        />
        <Route
          path="/login/admin"
          element={
            <GuestGuard>
              <AdminLogin />
            </GuestGuard>
          }
        />
        <Route
          path="/login/user"
          element={
            <GuestGuard>
              <AuthSplash />
            </GuestGuard>
          }
        />
        <Route
          path="/login/choice"
          element={
            <GuestGuard>
              <EntryChoice />
            </GuestGuard>
          }
        />
        <Route
          path="/login/account"
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
          path="/new-organization"
          element={
            <GuestGuard>
              <NewOrganization />
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
          path="/accept-invitation"
          element={
            <AppGuard>
              <AcceptInvitation />
            </AppGuard>
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
          <Route path="/team" element={<Team />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          {import.meta.env.DEV ? (
            <Route path="/design-system" element={<DesignSystem />} />
          ) : null}
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Central System Administrator console — isolated from the tenant app. */}
        <Route
          path="/system/login"
          element={
            <SystemGuestGuard>
              <SystemLogin />
            </SystemGuestGuard>
          }
        />
        <Route
          path="/system/forgot-password"
          element={
            <SystemGuestGuard>
              <SystemForgotPassword />
            </SystemGuestGuard>
          }
        />
        <Route
          path="/system/reset-password"
          element={
            <SystemGuestGuard>
              <SystemResetPassword />
            </SystemGuestGuard>
          }
        />
        <Route
          path="/system"
          element={
            <SystemGuard>
              <SystemShell />
            </SystemGuard>
          }
        >
          <Route index element={<Navigate to="/system/overview" replace />} />
          <Route path="overview" element={<SystemOverview />} />
          <Route path="organizations" element={<SystemOrganizations />} />
          <Route path="organizations/:id" element={<SystemOrganizationDetail />} />
          <Route path="users" element={<SystemUsers />} />
          <Route path="users/:id" element={<SystemUserDetail />} />
          <Route path="analytics" element={<SystemAnalytics />} />
          <Route path="audit-logs" element={<SystemAuditLogs />} />
          <Route path="health" element={<SystemHealth />} />
          <Route path="administrators" element={<SystemAdministrators />} />
          <Route path="change-password" element={<SystemChangePassword />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="*" element={<Navigate to="/system/overview" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}