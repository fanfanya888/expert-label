import { Navigate, Outlet } from "react-router-dom";

import {
  getPortalByRole,
  getRoleHome,
  readMockSession,
  type PortalArea,
} from "../utils/mockSession";

export function RootRedirect() {
  const session = readMockSession();
  return <Navigate to={session ? getRoleHome(session.role) : "/login"} replace />;
}

interface PortalRouteProps {
  allowedPortal: PortalArea;
}

export function PortalRoute({ allowedPortal }: PortalRouteProps) {
  const session = readMockSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (getPortalByRole(session.role) !== allowedPortal) {
    return <Navigate to={getRoleHome(session.role)} replace />;
  }

  return <Outlet />;
}
