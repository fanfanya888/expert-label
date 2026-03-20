import type {
  AdminUserCreatePayload,
  AdminUserItem,
  AdminUserListResult,
  AdminUserUpdatePayload,
  ApiEnvelope,
  PingInfo,
  ProjectItem,
  ProjectListResult,
  SystemInfo,
} from "../types/api";

type ErrorEnvelope = {
  message?: string;
  detail?: string;
};

async function parseResponsePayload<T>(response: Response): Promise<ApiEnvelope<T> | ErrorEnvelope | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as ApiEnvelope<T> | ErrorEnvelope;
  } catch {
    return null;
  }
}

function resolveErrorMessage(payload: ApiEnvelope<unknown> | ErrorEnvelope | null, response: Response): string {
  if (payload && typeof payload === "object") {
    if ("message" in payload && typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if ("detail" in payload && typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  }

  if (response.status === 404) {
    return "接口不存在或服务尚未完成启动";
  }
  if (response.status === 422) {
    return "请求参数不正确";
  }
  if (response.status >= 500) {
    return "服务暂时不可用，请稍后重试";
  }
  return "请求失败";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new Error("网络请求失败，请检查前后端服务是否已启动");
  }

  const payload = await parseResponsePayload<T>(response);

  if (!response.ok) {
    throw new Error(resolveErrorMessage(payload, response));
  }

  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error("服务返回格式不正确");
  }

  return payload.data as T;
}

export function fetchSystemInfo() {
  return request<SystemInfo>("/api/system/info");
}

export function pingSystem() {
  return request<PingInfo>("/api/system/ping");
}

export function fetchAdminProjects() {
  return request<ProjectListResult>("/api/admin/projects");
}

export function fetchMyProjects() {
  return request<ProjectListResult>("/api/me/projects");
}

export function fetchMyProjectDetail(projectId: number) {
  return request<ProjectItem>(`/api/me/projects/${projectId}`);
}

export function publishAdminProject(projectId: number) {
  return request<ProjectItem>(`/api/admin/projects/${projectId}/publish`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

export function unpublishAdminProject(projectId: number) {
  return request<ProjectItem>(`/api/admin/projects/${projectId}/unpublish`, {
    method: "PATCH",
  });
}

export function fetchAdminUsers() {
  return request<AdminUserListResult>("/api/admin/users");
}

export function fetchAdminUserDetail(userId: number) {
  return request<AdminUserItem>(`/api/admin/users/${userId}`);
}

export function createAdminUser(payload: AdminUserCreatePayload) {
  return request<AdminUserItem>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminUser(userId: number, payload: AdminUserUpdatePayload) {
  return request<AdminUserItem>(`/api/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
