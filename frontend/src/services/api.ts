import type {
  AdminProjectTaskCreatePayload,
  AdminProjectTaskItem,
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
  PingInfo,
  ProjectItem,
  ProjectListResult,
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

export function fetchAdminProjectDetail(projectId: number) {
  return request<ProjectItem>(`/api/admin/projects/${projectId}`);
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

export async function fetchAdminProjectTasks(projectId: number) {
  const data = await request<unknown>(`/api/admin/projects/${projectId}/tasks`);
  return ensureArray<AdminProjectTaskItem>(data);
}

export function createAdminProjectTask(projectId: number, payload: AdminProjectTaskCreatePayload) {
  return request<AdminProjectTaskItem>(`/api/admin/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminProjectTaskSubmissions(projectId: number, taskId: number, limit = 50) {
  const data = await request<unknown>(`/api/admin/projects/${projectId}/tasks/${taskId}/submissions?limit=${limit}`);
  return ensureArray<ModelResponseReviewSubmissionRecord | SingleTurnSearchCaseSubmissionSummary>(data);
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

export function fetchMyProjects() {
  return request<ProjectListResult>("/api/me/projects");
}

export function fetchMyProjectDetail(projectId: number) {
  return request<ProjectItem>(`/api/me/projects/${projectId}`);
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

export async function fetchSingleTurnSearchCaseCurrentTask(projectId: number) {
  const data = await request<SingleTurnSearchCaseTaskItem | null>(
    `/api/plugins/single_turn_search_case/projects/${projectId}/current-task`,
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

export async function fetchAdminSingleTurnSearchCaseRecords(projectId: number, taskId?: string | null) {
  const query = taskId ? `?task_id=${encodeURIComponent(taskId)}` : "";
  const data = await request<unknown>(`/api/plugins/single_turn_search_case/admin/projects/${projectId}/records${query}`);
  return ensureArray<SingleTurnSearchCaseSubmissionSummary>(data);
}

export function fetchAdminSingleTurnSearchCaseRecordDetail(projectId: number, submissionId: number) {
  return request<SingleTurnSearchCaseSubmissionDetail>(
    `/api/plugins/single_turn_search_case/admin/projects/${projectId}/records/${submissionId}`,
  );
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
