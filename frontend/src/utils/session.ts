import type { AuthSession, UserRole } from "../types/api";

export type PortalArea = "admin" | "user";

const STORAGE_KEY = "expert-label-session";

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "user";
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

export function getPortalByRole(role: UserRole): PortalArea {
  return isAdminRole(role) ? "admin" : "user";
}

export function getRoleHome(role: UserRole): string {
  return getPortalByRole(role) === "admin" ? "/admin/dashboard" : "/user/task-hall";
}

export function getSessionHome(session: AuthSession): string {
  if (session.user.role === "admin") {
    return "/admin/dashboard";
  }
  if (session.user.can_annotate || session.user.can_review) {
    return "/user/task-hall";
  }
  return "/login";
}

export function getPortalLabel(portal: PortalArea): string {
  return portal === "admin" ? "管理端" : "用户端";
}

export function getRoleLabel(role: UserRole): string {
  return role === "admin" ? "管理员" : "用户";
}

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (
      parsed &&
      typeof parsed.access_token === "string" &&
      typeof parsed.token_type === "string" &&
      typeof parsed.expires_at === "string" &&
      parsed.user &&
      typeof parsed.user.id === "number" &&
      typeof parsed.user.username === "string" &&
      typeof parsed.user.email === "string" &&
      typeof parsed.user.can_annotate === "boolean" &&
      typeof parsed.user.can_review === "boolean" &&
      isUserRole(parsed.user.role)
    ) {
      const expiresAt = new Date(parsed.expires_at).getTime();
      if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        return parsed;
      }
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  return null;
}

export function writeSession(session: AuthSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
