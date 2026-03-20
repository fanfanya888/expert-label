import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { AdminLayout } from "./layouts/AdminLayout";
import { UserLayout } from "./layouts/UserLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SystemInfoPage } from "./pages/SystemInfoPage";
import { AccountsPage } from "./pages/admin/AccountsPage";
import { MyProjectsPage } from "./pages/user/MyProjectsPage";
import { ProjectWorkspacePage } from "./pages/user/ProjectWorkspacePage";
import { PortalRoute, RootRedirect } from "./router/RouteGuards";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<PortalRoute allowedPortal="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="system" element={<SystemInfoPage />} />
          </Route>
        </Route>

        <Route element={<PortalRoute allowedPortal="user" />}>
          <Route path="/user" element={<UserLayout />}>
            <Route index element={<Navigate to="projects" replace />} />
            <Route path="projects" element={<MyProjectsPage />} />
            <Route path="projects/:projectId/workspace" element={<ProjectWorkspacePage />} />
          </Route>
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Router>
  );
}
