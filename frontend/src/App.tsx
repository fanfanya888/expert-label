import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { AdminLayout } from "./layouts/AdminLayout";
import { UserLayout } from "./layouts/UserLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SystemInfoPage } from "./pages/SystemInfoPage";
import { AccountsPage } from "./pages/admin/AccountsPage";
import { ProjectTasksPage } from "./pages/admin/ProjectTasksPage";
import { ModelResponseReviewPage } from "./pages/user/ModelResponseReviewPage";
import { ModelResponseReviewSubmissionDetailPage } from "./pages/user/ModelResponseReviewSubmissionDetailPage";
import { MyProjectsPage } from "./pages/user/MyProjectsPage";
import { ProjectReviewPage } from "./pages/user/ProjectReviewPage";
import { ProjectWorkspacePage } from "./pages/user/ProjectWorkspacePage";
import { ReviewTasksPage } from "./pages/user/ReviewTasksPage";
import { SingleTurnSearchCasePage } from "./pages/user/SingleTurnSearchCasePage";
import { SingleTurnSearchCaseSubmissionDetailPage } from "./pages/user/SingleTurnSearchCaseSubmissionDetailPage";
import { SubmissionRecordsPage } from "./pages/user/SubmissionRecordsPage";
import { TaskHallPage } from "./pages/user/TaskHallPage";
import { SingleTurnSearchCaseResultsPage } from "./pages/admin/SingleTurnSearchCaseResultsPage";
import { PortalRoute, RootRedirect, UserPortalRedirect } from "./router/RouteGuards";

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
            <Route path="projects/:projectId/tasks" element={<ProjectTasksPage />} />
            <Route path="projects/:projectId/search-case-results" element={<SingleTurnSearchCaseResultsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="system" element={<SystemInfoPage />} />
          </Route>
        </Route>

        <Route element={<PortalRoute allowedPortal="user" />}>
          <Route path="/user" element={<UserLayout />}>
            <Route index element={<UserPortalRedirect />} />
            <Route path="task-hall" element={<TaskHallPage />} />
            <Route path="annotation-tasks" element={<MyProjectsPage />} />
            <Route path="submission-records" element={<SubmissionRecordsPage />} />
            <Route path="review-tasks" element={<ReviewTasksPage />} />
            <Route path="projects/:projectId/workspace" element={<ProjectWorkspacePage />} />
          </Route>

          <Route path="/user/projects/:projectId/review" element={<ProjectReviewPage />} />
          <Route path="/user/projects/:projectId/model-response-review" element={<ModelResponseReviewPage />} />
          <Route
            path="/user/projects/:projectId/model-response-review/submissions/:taskId"
            element={<ModelResponseReviewSubmissionDetailPage />}
          />
          <Route
            path="/user/projects/:projectId/model-response-review/records/:submissionId"
            element={<ModelResponseReviewSubmissionDetailPage />}
          />

          <Route path="/user/projects/:projectId/single-turn-search-case" element={<SingleTurnSearchCasePage />} />
          <Route
            path="/user/projects/:projectId/single-turn-search-case/submissions/:taskId"
            element={<SingleTurnSearchCaseSubmissionDetailPage />}
          />
          <Route
            path="/user/projects/:projectId/single-turn-search-case/records/:submissionId"
            element={<SingleTurnSearchCaseSubmissionDetailPage />}
          />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Router>
  );
}
