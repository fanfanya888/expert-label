import { Navigate, Outlet } from "react-router-dom";

import {
  getPortalByRole,
  getSessionHome,
  readSession,
  type PortalArea,
} from "../utils/session";

export function RootRedirect() {
  const session = readSession();
  return <Navigate to={session ? getSessionHome(session) : "/login"} replace />;
}

export function UserPortalRedirect() {
  const session = readSession();
  return <Navigate to={session ? getSessionHome(session) : "/login"} replace />;
}

interface PortalRouteProps {
  allowedPortal: PortalArea;
}

export function PortalRoute({ allowedPortal }: PortalRouteProps) {
  const session = readSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (getPortalByRole(session.user.role) !== allowedPortal) {
    return <Navigate to={getSessionHome(session)} replace />;
  }

  return <Outlet />;
}
