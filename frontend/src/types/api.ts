export type UserRole = "admin" | "user";

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
  can_annotate: boolean;
  can_review: boolean;
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
  password: string;
  role: UserRole;
  is_active: boolean;
  can_annotate: boolean;
  can_review: boolean;
}

export interface AdminUserUpdatePayload {
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  can_annotate?: boolean;
  can_review?: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  can_annotate: boolean;
  can_review: boolean;
}

export interface AuthLoginPayload {
  username: string;
  password: string;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: AuthUser;
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

export interface ProjectDetailItem extends ProjectItem {
  instruction_markdown: string | null;
}

export interface ProjectListResult {
  total: number;
  items: ProjectItem[];
}

export interface TaskHallProjectItem extends ProjectItem {
  annotation_available_count: number;
  review_available_count: number;
  claim_progress_percent: number;
  current_user_annotation_limit: number;
  current_user_annotation_owned_count: number;
  current_user_task_id: string | null;
  current_user_task_status: string | null;
  current_user_review_limit: number;
  current_user_total_review_owned_count: number;
  current_user_review_owned_count: number;
  current_user_review_id: number | null;
  current_user_review_task_id: string | null;
  current_user_review_task_status: string | null;
  trial_passed: boolean;
  can_claim_annotation: boolean;
  can_claim_review: boolean;
}

export interface TaskHallListResult {
  total: number;
  items: TaskHallProjectItem[];
}

export interface MyAnnotationTaskQueueItem {
  project: ProjectItem;
  task: AdminProjectTaskItem;
  current_user_annotation_limit: number;
  current_user_annotation_owned_count: number;
  trial_passed: boolean;
}

export interface MyAnnotationTaskQueueListResult {
  total: number;
  items: MyAnnotationTaskQueueItem[];
}

export interface MyReviewTaskQueueItem {
  project: ProjectItem;
  task: AdminProjectTaskItem;
  review: ProjectTaskReviewItem;
  current_user_review_limit: number;
  current_user_total_review_owned_count: number;
  current_user_review_owned_count: number;
}

export interface MyReviewTaskQueueListResult {
  total: number;
  items: MyReviewTaskQueueItem[];
}

export interface UserSubmissionRecordItem {
  submission_type: "annotation" | "review";
  plugin_code: string;
  plugin_name: string;
  submission_id: number;
  project_id: number | null;
  project_name: string | null;
  task_id: string;
  current_status: string | null;
  submitted_at: string;
  title: string;
  summary: string | null;
  result_label: string | null;
  review_round: number | null;
  review_result: "pass" | "reject" | null;
  review_comment: string | null;
}

export interface UserSubmissionRecordListResult {
  total: number;
  items: UserSubmissionRecordItem[];
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
  annotation_assignee_id: number | null;
  annotation_assignee_username: string | null;
  annotation_claimed_at: string | null;
  annotation_submitted_at: string | null;
  approved_at: string | null;
  review_round_count: number;
  latest_reviewer_id: number | null;
  latest_reviewer_username: string | null;
  latest_review_status: string | null;
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

export interface ProjectTaskReviewItem {
  id: number;
  project_task_id: number;
  review_round: number;
  review_status: string;
  reviewer_id: number | null;
  reviewer_username: string | null;
  review_result: "pass" | "reject" | null;
  review_comment: string | null;
  review_annotations: ProjectTaskReviewAnnotationItem[];
  claimed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTaskReviewAnnotationItem {
  section_key: string;
  section_label: string;
  comment: string;
}

export interface ProjectTaskReviewSubmitPayload {
  review_result: "pass" | "reject";
  review_comment: string;
  review_annotations: ProjectTaskReviewAnnotationItem[];
}

export interface ProjectTaskReviewTaskDetail {
  review: ProjectTaskReviewItem;
  task: AdminProjectTaskItem;
  submission: Record<string, unknown> | null;
  review_history: ProjectTaskReviewItem[];
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
  latest_review: ModelResponseReviewLatestReview | null;
}

export interface ModelResponseReviewLatestReview {
  review_id: number;
  review_round: number;
  review_result: "pass" | "reject" | null;
  review_comment: string | null;
  review_annotations: ProjectTaskReviewAnnotationItem[];
  submitted_at: string | null;
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

export interface SearchCaseAiReviewMissingField {
  field: string;
  label: string;
  message: string;
}

export interface SearchCaseAiReviewCheckItem {
  passed: boolean;
  detail: string;
}

export interface SearchCaseAiRuleReviewResult {
  status: "pass" | "risk" | "fail";
  issues: string[];
  checks: Record<string, SearchCaseAiReviewCheckItem>;
  reference_advice: string;
  extra_suggestions: string[];
}

export interface SearchCaseAiModelReviewResult {
  ai_judgement: "yes" | "no" | "uncertain";
  human_judgement: "yes" | "no";
  consistency: "consistent" | "inconsistent" | "debatable";
  remark_quality: "good" | "weak" | "insufficient";
  reason: string;
  reference_advice: string;
  extra_suggestions: string[];
}

export interface SearchCaseAiReviewSummary {
  overall_status: "pass" | "risk" | "fail";
  summary: string;
}

export interface SingleTurnSearchCaseAiReviewRuleDraft {
  rule_index: number;
  rule_category?: string | null;
  rule_text?: string | null;
  weight?: number | null;
  evidence_source_type?: SearchCaseRuleInput["evidence_source_type"] | null;
  reference_url?: string | null;
  quote_text?: string | null;
  evidence_screenshot?: string | null;
  optional_note?: string | null;
  model_a_human_hit?: boolean | null;
  model_a_human_note?: string | null;
  model_b_human_hit?: boolean | null;
  model_b_human_note?: string | null;
}

export interface SingleTurnSearchCaseAiReviewPayload {
  project_id: number;
  task_id?: string | null;
  domain?: string | null;
  scenario_description?: string | null;
  prompt?: string | null;
  timeliness_tag?: string | null;
  model_a: Partial<SearchCaseModelAnswer>;
  model_b: Partial<SearchCaseModelAnswer>;
  rule: SingleTurnSearchCaseAiReviewRuleDraft;
}

export interface SingleTurnSearchCaseAiReviewResponse {
  ok: boolean;
  precheck: {
    passed: boolean;
    missing_fields: SearchCaseAiReviewMissingField[];
  };
  review_result: SearchCaseAiReviewSummary | null;
  rule_review: SearchCaseAiRuleReviewResult | null;
  model_1_review: SearchCaseAiModelReviewResult | null;
  model_2_review: SearchCaseAiModelReviewResult | null;
  provider?: string | null;
  error_message?: string | null;
}

export interface SingleTurnSearchCaseAiRuleCheckResponse {
  ok: boolean;
  precheck: {
    passed: boolean;
    missing_fields: SearchCaseAiReviewMissingField[];
  };
  result: SearchCaseAiRuleReviewResult | null;
  provider?: string | null;
  error_message?: string | null;
}

export interface SingleTurnSearchCaseAiModelCheckResponse {
  ok: boolean;
  precheck: {
    passed: boolean;
    missing_fields: SearchCaseAiReviewMissingField[];
  };
  result: SearchCaseAiModelReviewResult | null;
  provider?: string | null;
  error_message?: string | null;
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

export interface SingleTurnSearchCaseLatestReview {
  review_id: number;
  review_round: number;
  review_result: "pass" | "reject" | null;
  review_comment: string | null;
  review_annotations: ProjectTaskReviewAnnotationItem[];
  submitted_at: string | null;
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
  latest_review: SingleTurnSearchCaseLatestReview | null;
}
