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
  plugin_code: string | null;
  entry_path: string | null;
  publish_status: string;
  is_visible: boolean;
  source_type: string;
  external_url: string | null;
  is_published: boolean;
  published_at: string | null;
  published_by: number | null;
  created_at: string;
  updated_at: string;
  task_total: number;
  task_completed: number;
  task_pending: number;
  owner: UserSummary | null;
}

export interface ProjectListResult {
  total: number;
  items: ProjectItem[];
}

export interface AdminProjectTaskItem {
  id: number;
  project_id: number;
  plugin_code: string;
  external_task_id: string;
  task_payload: Record<string, unknown>;
  publish_status: string;
  task_status: string;
  is_visible: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProjectTaskListResult {
  total: number;
  items: AdminProjectTaskItem[];
}

export interface AdminProjectTaskCreatePayload {
  external_task_id?: string | null;
  task_payload: Record<string, unknown>;
}

export interface ModelResponseReviewTaskTemplatePayload {
  prompt: string;
  model_reply: string | null;
  task_category: string;
  metadata: Record<string, unknown>;
  rubric_version: string;
}

export interface ModelResponseReviewSchema {
  plugin_code: string;
  plugin_version: string;
  page_title: string;
  sections: string[];
  task_category_options: string[];
  answer_rating_options: string[];
  rating_reason_placeholder: string;
}

export interface ModelResponseReviewRubricLevel {
  rating: string;
  guidance: string;
}

export interface ModelResponseReviewRubric {
  title: string;
  version: string;
  intro: string;
  levels: ModelResponseReviewRubricLevel[];
  review_notes: string[];
}

export interface ModelResponseReviewProjectStats {
  project_id: number;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
}

export interface ModelResponseReviewTaskItem {
  project_id: number;
  task_id: string;
  prompt: string;
  model_reply: string | null;
  task_category: string;
  metadata: Record<string, unknown>;
  rubric_version: string;
  status: string;
}

export interface ModelResponseReviewSubmissionPayload {
  project_id: number;
  task_id: string;
  annotator_id?: number | null;
  task_category: string;
  answer_rating: string;
  rating_reason: string;
  prompt_snapshot: string;
  model_reply_snapshot: string;
  rubric_version: string;
  rubric_snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ModelResponseReviewValidationIssue {
  field: string;
  message: string;
}

export interface ModelResponseReviewValidationResult {
  valid: boolean;
  errors: ModelResponseReviewValidationIssue[];
  normalized: ModelResponseReviewSubmissionPayload | null;
}

export interface ModelResponseReviewSubmissionResult {
  submission_id: number;
  project_id: number;
  task_id: string;
  plugin_code: string;
  plugin_version: string;
  task_status: string;
  submitted_at: string;
}

export interface ModelResponseReviewSubmissionRecord {
  submission_id: number;
  project_id: number | null;
  task_id: string;
  annotator_id: number | null;
  task_category: string;
  answer_rating: string;
  rating_reason: string;
  prompt_snapshot: string;
  model_reply_snapshot: string;
  rubric_version: string;
  metadata: Record<string, unknown> | null;
  plugin_code: string;
  plugin_version: string;
  submitted_at: string;
}

export interface SingleTurnSearchCaseSchema {
  plugin_code: string;
  plugin_version: string;
  page_title: string;
  sections: string[];
  evidence_source_options: string[];
  default_domain_options: string[];
  default_timeliness_options: string[];
  model_labels: string[];
}

export interface SingleTurnSearchCaseTaskTemplatePayload {
  task_name: string;
  task_description?: string | null;
  instruction_text?: string | null;
  require_model_screenshot: boolean;
  require_share_link: boolean;
  scoring_rules_min: number;
  scoring_rules_max: number;
  min_penalty_rules: number;
  timeliness_options: string[];
  domain_options: string[];
  show_case_guidance: boolean;
  model_a_name: string;
  model_b_name: string;
}

export interface SingleTurnSearchCaseTaskItem extends SingleTurnSearchCaseTaskTemplatePayload {
  project_id: number;
  task_id: string;
  status: string;
}

export interface SearchCaseModelAnswer {
  model_name: string;
  response_text: string;
  share_link: string;
  screenshot: string;
}

export interface SearchCaseRuleInput {
  rule_category: string;
  rule_text: string;
  weight: number;
  evidence_source_type: "web_link" | "prompt_requirement" | "project_document" | "none";
  reference_url?: string | null;
  quote_text?: string | null;
  evidence_screenshot?: string | null;
  optional_note?: string | null;
  sign?: "positive" | "negative";
}

export interface SearchCaseRuleEvaluation {
  rule_index: number;
  hit: boolean;
  note: string;
}

export interface SearchCaseSoftCheck {
  code: string;
  level: "info" | "warning";
  message: string;
}

export interface SearchCaseScoreSummary {
  positive_total_score: number;
  model_a_raw_score: number;
  model_a_percentage: number;
  model_b_raw_score: number;
  model_b_percentage: number;
  score_gap: number;
  model_a_below_target: boolean;
  score_gap_exceeds_target: boolean;
}

export interface SingleTurnSearchCaseSubmissionPayload {
  project_id: number;
  task_id: string;
  annotator_id?: number | null;
  domain: string;
  scenario_description: string;
  prompt: string;
  timeliness_tag: string;
  model_a: SearchCaseModelAnswer;
  model_b: SearchCaseModelAnswer;
  reference_answer: string;
  scoring_rules: SearchCaseRuleInput[];
  model_a_evaluations: SearchCaseRuleEvaluation[];
  model_b_evaluations: SearchCaseRuleEvaluation[];
}

export interface SingleTurnSearchCaseValidationIssue {
  field: string;
  message: string;
}

export interface SingleTurnSearchCaseValidationResult {
  valid: boolean;
  errors: SingleTurnSearchCaseValidationIssue[];
  soft_checks: SearchCaseSoftCheck[];
  score_preview: SearchCaseScoreSummary | null;
  normalized: SingleTurnSearchCaseSubmissionPayload | null;
}

export interface SingleTurnSearchCaseSubmissionResult {
  submission_id: number;
  project_id: number;
  task_id: string;
  plugin_code: string;
  plugin_version: string;
  task_status: string;
  status: string;
  score_summary: SearchCaseScoreSummary;
  submitted_at: string;
}

export interface SingleTurnSearchCaseSubmissionSummary {
  submission_id: number;
  project_id: number | null;
  task_id: string;
  annotator_id: number | null;
  domain: string;
  prompt: string;
  timeliness_tag: string;
  rule_count: number;
  penalty_rule_count: number;
  model_a_raw_score: number;
  model_a_percentage: number;
  model_b_raw_score: number;
  model_b_percentage: number;
  score_gap: number;
  status: string;
  submitted_at: string;
}

export interface SingleTurnSearchCaseSubmissionDetail extends SingleTurnSearchCaseSubmissionSummary {
  scenario_description: string;
  model_a: SearchCaseModelAnswer;
  model_b: SearchCaseModelAnswer;
  reference_answer: string;
  scoring_rules: SearchCaseRuleInput[];
  model_a_evaluations: SearchCaseRuleEvaluation[];
  model_b_evaluations: SearchCaseRuleEvaluation[];
  score_summary: SearchCaseScoreSummary;
  soft_checks: SearchCaseSoftCheck[];
  template_snapshot: Record<string, unknown>;
  plugin_code: string;
  plugin_version: string;
}
