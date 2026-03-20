export type UserRole = "super_admin" | "admin" | "annotator";

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface PluginMeta {
  key: string;
  name: string;
  version: string;
}

export interface SystemInfo {
  app_name: string;
  environment: string;
  debug: boolean;
  api_prefix: string;
  redis_enabled: boolean;
  plugins: PluginMeta[];
}

export interface PingInfo {
  status: string;
  now: string;
}

export interface UserSummary {
  id: number;
  username: string;
  email: string;
}

export interface AdminUserItem {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserListResult {
  total: number;
  items: AdminUserItem[];
}

export interface AdminUserCreatePayload {
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

export interface AdminUserUpdatePayload {
  username?: string;
  email?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface ProjectItem {
  id: number;
  name: string;
  description: string | null;
  owner_id: number | null;
  external_url: string | null;
  is_published: boolean;
  published_at: string | null;
  published_by: number | null;
  created_at: string;
  updated_at: string;
  owner: UserSummary | null;
}

export interface ProjectListResult {
  total: number;
  items: ProjectItem[];
}
