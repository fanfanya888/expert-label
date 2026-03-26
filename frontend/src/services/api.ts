import type {
  AdminProjectTaskCreatePayload,
  AdminProjectTaskItem,
  AuthLoginPayload,
  AuthSession,
  AdminUserCreatePayload,
  AdminUserItem,
  AdminUserListResult,
  AdminUserUpdatePayload,
  ApiEnvelope,
  ModelResponseReviewProjectStats,
  ModelResponseReviewRubric,
  ModelResponseReviewSchema,
  ModelResponseReviewSubmissionPayload,
  ModelResponseReviewSubmissionRecord,
  ModelResponseReviewSubmissionResult,
  ModelResponseReviewTaskItem,
  ModelResponseReviewValidationResult,
  MyAnnotationTaskQueueListResult,
  MyReviewTaskQueueListResult,
  PingInfo,
  ProjectDetailItem,
  ProjectItem,
  ProjectListResult,
  ProjectTaskReviewItem,
  ProjectTaskReviewSubmitPayload,
  ProjectTaskReviewTaskDetail,
  SingleTurnSearchCaseSchema,
  SingleTurnSearchCaseAiModelCheckResponse,
  SingleTurnSearchCaseAiReviewPayload,
  SingleTurnSearchCaseAiReviewResponse,
  SingleTurnSearchCaseAiRuleCheckResponse,
  SingleTurnSearchCaseSubmissionDetail,
  SingleTurnSearchCaseSubmissionPayload,
  SingleTurnSearchCaseSubmissionResult,
  SingleTurnSearchCaseSubmissionSummary,
  SingleTurnSearchCaseTaskItem,
  SingleTurnSearchCaseValidationResult,
  SystemInfo,
  TaskHallListResult,
  UserSubmissionRecordListResult,
} from "../types/api";
import { clearSession, readSession } from "../utils/session";

type ErrorEnvelope = {
  message?: string;
  detail?: string;
};

type DownloadResult = {
  blob: Blob;
  filename: string | null;
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
  if (response.status === 401) {
    return "登录已失效，请重新登录";
  }
  if (response.status === 403) {
    return "当前账号无权访问该内容";
  }
  if (response.status === 409) {
    return "数据冲突，请检查后重试";
  }
  if (response.status === 422) {
    return "请求参数不正确";
  }
  if (response.status >= 500) {
    return "服务暂时不可用，请稍后重试";
  }
  return "请求失败";
}

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === "object" && "items" in value) {
    const items = (value as { items?: unknown }).items;
    return Array.isArray(items) ? (items as T[]) : [];
  }
  return [];
}

function resolveDownloadFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const asciiMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1] ?? null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const session = readSession();
  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  try {
    response = await fetch(path, {
      ...init,
      headers,
    });
  } catch {
    throw new Error("网络请求失败，请检查前后端服务是否已启动");
  }

  const payload = await parseResponsePayload<T>(response);
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    throw new Error(resolveErrorMessage(payload, response));
  }

  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error("服务返回格式不正确");
  }

  return payload.data as T;
}

async function requestDownload(path: string, init?: RequestInit): Promise<DownloadResult> {
  let response: Response;
  const session = readSession();
  const headers = new Headers(init?.headers ?? {});
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  try {
    response = await fetch(path, {
      ...init,
      headers,
    });
  } catch {
    throw new Error("网络请求失败，请检查前后端服务是否已启动");
  }

  if (!response.ok) {
    const payload = await parseResponsePayload<null>(response);
    if (response.status === 401) {
      clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    throw new Error(resolveErrorMessage(payload, response));
  }

  return {
    blob: await response.blob(),
    filename: resolveDownloadFilename(response.headers.get("Content-Disposition")),
  };
}

export function fetchSystemInfo() {
  return request<SystemInfo>("/api/system/info");
}

export function pingSystem() {
  return request<PingInfo>("/api/system/ping");
}

export function login(payload: AuthLoginPayload) {
  return request<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return request<null>("/api/auth/logout", {
    method: "POST",
  });
}

export function fetchCurrentSessionUser() {
  return request<AuthSession["user"]>("/api/auth/me");
}

export function fetchAdminProjects() {
  return request<ProjectListResult>("/api/admin/projects");
}

export function fetchAdminProjectDetail(projectId: number) {
  return request<ProjectDetailItem>(`/api/admin/projects/${projectId}`);
}

export function updateAdminProjectInstruction(projectId: number, instruction_markdown: string | null) {
  return request<ProjectDetailItem>(`/api/admin/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ instruction_markdown }),
  });
}

export function publishAdminProject(projectId: number) {
  return request<ProjectItem>(`/api/admin/projects/${projectId}/publish`, {
    method: "PATCH",
  });
}

export function unpublishAdminProject(projectId: number) {
  return request<ProjectItem>(`/api/admin/projects/${projectId}/unpublish`, {
    method: "PATCH",
  });
}

export async function fetchAdminProjectTasks(projectId: number) {
  const data = await request<unknown>(`/api/admin/projects/${projectId}/tasks`);
  return ensureArray<AdminProjectTaskItem>(data);
}

export function exportAdminProjectTasks(projectId: number, format: "json") {
  return requestDownload(`/api/admin/projects/${projectId}/tasks/export?format=${encodeURIComponent(format)}`);
}

export function createAdminProjectTask(projectId: number, payload: AdminProjectTaskCreatePayload) {
  return request<AdminProjectTaskItem>(`/api/admin/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminProjectTask(projectId: number, taskId: number) {
  return request<null>(`/api/admin/projects/${projectId}/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function fetchAdminProjectTaskSubmissions(projectId: number, taskId: number, limit = 50) {
  const data = await request<unknown>(`/api/admin/projects/${projectId}/tasks/${taskId}/submissions?limit=${limit}`);
  return ensureArray<ModelResponseReviewSubmissionRecord | SingleTurnSearchCaseSubmissionSummary>(data);
}

export async function fetchAdminProjectTaskReviews(projectId: number, taskId: number) {
  const data = await request<unknown>(`/api/admin/projects/${projectId}/tasks/${taskId}/reviews`);
  return ensureArray<ProjectTaskReviewItem>(data);
}

export async function fetchAdminProjectTaskReviewDetail(projectId: number, taskId: number, reviewId: number) {
  return request<ProjectTaskReviewTaskDetail>(`/api/admin/projects/${projectId}/tasks/${taskId}/reviews/${reviewId}`);
}

export function publishAdminProjectTask(projectId: number, taskId: number) {
  return request<AdminProjectTaskItem>(`/api/admin/projects/${projectId}/tasks/${taskId}/publish`, {
    method: "PATCH",
  });
}

export function unpublishAdminProjectTask(projectId: number, taskId: number) {
  return request<AdminProjectTaskItem>(`/api/admin/projects/${projectId}/tasks/${taskId}/unpublish`, {
    method: "PATCH",
  });
}

export function dispatchAdminProjectTaskReview(projectId: number, taskId: number) {
  return request<ProjectTaskReviewItem>(`/api/admin/projects/${projectId}/tasks/${taskId}/dispatch-review`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function approveAdminProjectTask(projectId: number, taskId: number) {
  return request<AdminProjectTaskItem>(`/api/admin/projects/${projectId}/tasks/${taskId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function fetchMyProjects() {
  return request<ProjectListResult>("/api/me/projects");
}

export function fetchMyTaskHall() {
  return request<TaskHallListResult>("/api/me/projects/hall");
}

export function fetchMyAnnotationTasks() {
  return request<MyAnnotationTaskQueueListResult>("/api/me/projects/annotation-tasks");
}

export function fetchMyReviewTasks() {
  return request<MyReviewTaskQueueListResult>("/api/me/projects/review-tasks");
}

export function fetchMyReviewProjects() {
  return request<TaskHallListResult>("/api/me/projects/review/queue");
}

export function fetchMySubmissionRecords() {
  return request<UserSubmissionRecordListResult>("/api/me/projects/submission-records");
}

export function fetchMyProjectDetail(projectId: number) {
  return request<ProjectDetailItem>(`/api/me/projects/${projectId}`);
}

export async function claimMyProjectAnnotationTask(projectId: number) {
  const data = await request<AdminProjectTaskItem | null>(`/api/me/projects/${projectId}/annotation-task/claim`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data && typeof data === "object" ? data : null;
}

export function releaseMyProjectAnnotationTask(projectId: number) {
  return request<null>(`/api/me/projects/${projectId}/annotation-task/release`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function releaseMyProjectAnnotationTaskByTaskId(projectId: number, taskId: string) {
  return request<null>(`/api/me/projects/${projectId}/annotation-task/${encodeURIComponent(taskId)}/release`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function claimMyProjectReviewTask(projectId: number) {
  const data = await request<ProjectTaskReviewTaskDetail | null>(`/api/me/projects/${projectId}/review-task/claim`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data && typeof data === "object" ? data : null;
}

export async function fetchMyProjectCurrentReviewTask(projectId: number) {
  const data = await request<ProjectTaskReviewTaskDetail | null>(`/api/me/projects/${projectId}/review-task/current`);
  return data && typeof data === "object" ? data : null;
}

export async function fetchMyProjectReviewTask(projectId: number, reviewId: number) {
  const data = await request<ProjectTaskReviewTaskDetail | null>(`/api/me/projects/${projectId}/review-task/${reviewId}`);
  return data && typeof data === "object" ? data : null;
}

export function submitMyProjectReviewTask(
  projectId: number,
  reviewId: number,
  payload: ProjectTaskReviewSubmitPayload,
) {
  return request<ProjectTaskReviewItem>(`/api/me/projects/${projectId}/review-task/${reviewId}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchModelResponseReviewSchema() {
  return request<ModelResponseReviewSchema>("/api/plugins/model_response_review/schema");
}

export function fetchSingleTurnSearchCaseSchema() {
  return request<SingleTurnSearchCaseSchema>("/api/plugins/single_turn_search_case/schema");
}

export function fetchModelResponseReviewRubric() {
  return request<ModelResponseReviewRubric>("/api/plugins/model_response_review/rubric");
}

export function fetchModelResponseReviewProjectStats(projectId: number) {
  return request<ModelResponseReviewProjectStats>(`/api/plugins/model_response_review/projects/${projectId}/stats`);
}

export function fetchSingleTurnSearchCaseProjectStats(projectId: number) {
  return request<ModelResponseReviewProjectStats>(`/api/plugins/single_turn_search_case/projects/${projectId}/stats`);
}

export async function fetchModelResponseReviewCurrentTask(projectId: number) {
  const data = await request<ModelResponseReviewTaskItem | null>(
    `/api/plugins/model_response_review/projects/${projectId}/current-task`,
  );
  return data && typeof data === "object" ? data : null;
}

export async function fetchModelResponseReviewTask(projectId: number, taskId: string) {
  const data = await request<ModelResponseReviewTaskItem | null>(
    `/api/plugins/model_response_review/projects/${projectId}/tasks/${encodeURIComponent(taskId)}`,
  );
  return data && typeof data === "object" ? data : null;
}

export async function fetchModelResponseReviewMySubmissionDetail(projectId: number, taskId: string) {
  const data = await request<ModelResponseReviewSubmissionRecord | null>(
    `/api/plugins/model_response_review/projects/${projectId}/tasks/${encodeURIComponent(taskId)}/submission-detail`,
  );
  return data && typeof data === "object" ? data : null;
}

export async function fetchModelResponseReviewMySubmissionDetailById(projectId: number, submissionId: number) {
  const data = await request<ModelResponseReviewSubmissionRecord | null>(
    `/api/plugins/model_response_review/projects/${projectId}/records/${submissionId}`,
  );
  return data && typeof data === "object" ? data : null;
}

export async function fetchSingleTurnSearchCaseCurrentTask(projectId: number) {
  const data = await request<SingleTurnSearchCaseTaskItem | null>(
    `/api/plugins/single_turn_search_case/projects/${projectId}/current-task`,
  );
  return data && typeof data === "object" ? data : null;
}

export async function fetchSingleTurnSearchCaseTask(projectId: number, taskId: string) {
  const data = await request<SingleTurnSearchCaseTaskItem | null>(
    `/api/plugins/single_turn_search_case/projects/${projectId}/tasks/${encodeURIComponent(taskId)}`,
  );
  return data && typeof data === "object" ? data : null;
}

export async function fetchSingleTurnSearchCaseMySubmissionDetail(projectId: number, taskId: string) {
  const data = await request<SingleTurnSearchCaseSubmissionDetail | null>(
    `/api/plugins/single_turn_search_case/projects/${projectId}/tasks/${encodeURIComponent(taskId)}/submission-detail`,
  );
  return data && typeof data === "object" ? data : null;
}

export async function fetchSingleTurnSearchCaseMySubmissionDetailById(projectId: number, submissionId: number) {
  const data = await request<SingleTurnSearchCaseSubmissionDetail | null>(
    `/api/plugins/single_turn_search_case/projects/${projectId}/records/${submissionId}`,
  );
  return data && typeof data === "object" ? data : null;
}

export function generateModelResponseReviewTaskResponse(projectId: number, taskId: string, force = false) {
  return request<ModelResponseReviewTaskItem>(
    `/api/plugins/model_response_review/projects/${projectId}/tasks/${taskId}/generate-response${force ? "?force=true" : ""}`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function fetchModelResponseReviewSubmissionRecords(projectId: number, limit = 10) {
  const data = await request<unknown>(`/api/plugins/model_response_review/projects/${projectId}/submissions?limit=${limit}`);
  return ensureArray<ModelResponseReviewSubmissionRecord>(data);
}

export function validateModelResponseReviewSubmission(
  projectId: number,
  payload: ModelResponseReviewSubmissionPayload,
) {
  return request<ModelResponseReviewValidationResult>(`/api/plugins/model_response_review/projects/${projectId}/validate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitModelResponseReviewSubmission(
  projectId: number,
  payload: ModelResponseReviewSubmissionPayload,
) {
  return request<ModelResponseReviewSubmissionResult>(`/api/plugins/model_response_review/projects/${projectId}/submissions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function validateSingleTurnSearchCaseSubmission(
  projectId: number,
  payload: SingleTurnSearchCaseSubmissionPayload,
) {
  return request<SingleTurnSearchCaseValidationResult>(`/api/plugins/single_turn_search_case/projects/${projectId}/validate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function reviewSingleTurnSearchCaseRuleWithAi(
  projectId: number,
  payload: SingleTurnSearchCaseAiReviewPayload,
) {
  return request<SingleTurnSearchCaseAiReviewResponse>(
    `/api/plugins/single_turn_search_case/projects/${projectId}/rule-ai-review`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function reviewSingleTurnSearchCaseRuleDefinitionWithAi(
  projectId: number,
  payload: SingleTurnSearchCaseAiReviewPayload,
) {
  return request<SingleTurnSearchCaseAiRuleCheckResponse>(
    `/api/plugins/single_turn_search_case/projects/${projectId}/rule-definition-ai-review`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function reviewSingleTurnSearchCaseModelAWithAi(
  projectId: number,
  payload: SingleTurnSearchCaseAiReviewPayload,
) {
  return request<SingleTurnSearchCaseAiModelCheckResponse>(
    `/api/plugins/single_turn_search_case/projects/${projectId}/model-a-ai-review`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function reviewSingleTurnSearchCaseModelBWithAi(
  projectId: number,
  payload: SingleTurnSearchCaseAiReviewPayload,
) {
  return request<SingleTurnSearchCaseAiModelCheckResponse>(
    `/api/plugins/single_turn_search_case/projects/${projectId}/model-b-ai-review`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function submitSingleTurnSearchCaseSubmission(
  projectId: number,
  payload: SingleTurnSearchCaseSubmissionPayload,
) {
  return request<SingleTurnSearchCaseSubmissionResult>(`/api/plugins/single_turn_search_case/projects/${projectId}/submissions`, {
    method: "POST",
    body: JSON.stringify(payload),
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
