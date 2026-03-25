import { Suspense, lazy, type ComponentType } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { PortalRoute, RootRedirect, UserPortalRedirect } from "./router/RouteGuards";

type NamedComponentModule<T extends string> = Record<T, ComponentType>;

function lazyNamedPage<T extends string>(
  loader: () => Promise<NamedComponentModule<T>>,
  exportName: T,
) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] };
  });
}

const AdminLayout = lazyNamedPage(() => import("./layouts/AdminLayout"), "AdminLayout");
const UserLayout = lazyNamedPage(() => import("./layouts/UserLayout"), "UserLayout");

const DashboardPage = lazyNamedPage(() => import("./pages/DashboardPage"), "DashboardPage");
const LoginPage = lazyNamedPage(() => import("./pages/LoginPage"), "LoginPage");
const ProjectsPage = lazyNamedPage(() => import("./pages/ProjectsPage"), "ProjectsPage");
const SystemInfoPage = lazyNamedPage(() => import("./pages/SystemInfoPage"), "SystemInfoPage");

const AccountsPage = lazyNamedPage(() => import("./pages/admin/AccountsPage"), "AccountsPage");
const ProjectTasksPage = lazyNamedPage(() => import("./pages/admin/ProjectTasksPage"), "ProjectTasksPage");
const SingleTurnSearchCaseResultsPage = lazyNamedPage(
  () => import("./pages/admin/SingleTurnSearchCaseResultsPage"),
  "SingleTurnSearchCaseResultsPage",
);

const ModelResponseReviewPage = lazyNamedPage(
  () => import("./pages/user/ModelResponseReviewPage"),
  "ModelResponseReviewPage",
);
const ModelResponseReviewSubmissionDetailPage = lazyNamedPage(
  () => import("./pages/user/ModelResponseReviewSubmissionDetailPage"),
  "ModelResponseReviewSubmissionDetailPage",
);
const MyProjectsPage = lazyNamedPage(() => import("./pages/user/MyProjectsPage"), "MyProjectsPage");
const ProjectReviewPage = lazyNamedPage(() => import("./pages/user/ProjectReviewPage"), "ProjectReviewPage");
const ProjectWorkspacePage = lazyNamedPage(() => import("./pages/user/ProjectWorkspacePage"), "ProjectWorkspacePage");
const ReviewTasksPage = lazyNamedPage(() => import("./pages/user/ReviewTasksPage"), "ReviewTasksPage");
const SingleTurnSearchCasePage = lazyNamedPage(
  () => import("./pages/user/SingleTurnSearchCasePage"),
  "SingleTurnSearchCasePage",
);
const SingleTurnSearchCaseSubmissionDetailPage = lazyNamedPage(
  () => import("./pages/user/SingleTurnSearchCaseSubmissionDetailPage"),
  "SingleTurnSearchCaseSubmissionDetailPage",
);
const SubmissionRecordsPage = lazyNamedPage(
  () => import("./pages/user/SubmissionRecordsPage"),
  "SubmissionRecordsPage",
);
const TaskHallPage = lazyNamedPage(() => import("./pages/user/TaskHallPage"), "TaskHallPage");

function RouteLoadingFallback() {
  return (
    <div className="route-loading-screen">
      <div className="route-loading-spinner" />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<RouteLoadingFallback />}>
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
      </Suspense>
    </Router>
  );
}
