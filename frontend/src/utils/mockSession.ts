import type { UserRole } from "../types/api";

export type PortalArea = "admin" | "user";

export interface MockSession {
  role: UserRole;
  username: string;
}

const STORAGE_KEY = "expert-label-mock-session";

export function isAdminRole(role: UserRole): boolean {
  return role === "super_admin" || role === "admin";
}

export function getPortalByRole(role: UserRole): PortalArea {
  return isAdminRole(role) ? "admin" : "user";
}

export function getRoleHome(role: UserRole): string {
  return getPortalByRole(role) === "admin" ? "/admin/dashboard" : "/user/projects";
}

export function getPortalLabel(portal: PortalArea): string {
  return portal === "admin" ? "管理端" : "用户端";
}

export function getRoleLabel(role: UserRole): string {
  if (role === "super_admin") {
    return "超级管理员";
  }
  if (role === "admin") {
    return "管理员";
  }
  return "标注员";
}

export function readMockSession(): MockSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as MockSession;
    if (
      parsed &&
      (parsed.role === "super_admin" ||
        parsed.role === "admin" ||
        parsed.role === "annotator") &&
      typeof parsed.username === "string"
    ) {
      return parsed;
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return null;
}

export function writeMockSession(session: MockSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearMockSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
