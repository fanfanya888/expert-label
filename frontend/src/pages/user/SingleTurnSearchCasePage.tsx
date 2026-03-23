import {
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import {
  fetchSingleTurnSearchCaseCurrentTask,
  fetchSingleTurnSearchCaseProjectStats,
  fetchSingleTurnSearchCaseSchema,
  reviewSingleTurnSearchCaseModelAWithAi,
  reviewSingleTurnSearchCaseModelBWithAi,
  reviewSingleTurnSearchCaseRuleDefinitionWithAi,
  submitSingleTurnSearchCaseSubmission,
  validateSingleTurnSearchCaseSubmission,
} from "../../services/api";
import type {
  SearchCaseAiModelReviewResult,
  SearchCaseAiReviewMissingField,
  SearchCaseAiRuleReviewResult,
  SearchCaseModelAnswer,
  SearchCaseRuleEvaluation,
  SearchCaseRuleInput,
  SearchCaseSoftCheck,
  SearchCaseScoreSummary,
  SingleTurnSearchCaseAiModelCheckResponse,
  SingleTurnSearchCaseAiReviewPayload,
  SingleTurnSearchCaseAiRuleCheckResponse,
  SingleTurnSearchCaseSchema,
  SingleTurnSearchCaseSubmissionPayload,
  SingleTurnSearchCaseSubmissionResult,
  SingleTurnSearchCaseTaskItem,
} from "../../types/api";

interface SearchCaseRuleFormItem {
  rule_category: string;
  rule_text: string;
  weight: number | null;
  evidence_source_type: "web_link" | "prompt_requirement" | "project_document" | "none";
  reference_url?: string;
  quote_text?: string;
  evidence_screenshot?: string;
  optional_note?: string;
  model_a_hit?: boolean;
  model_a_note?: string;
  model_b_hit?: boolean;
  model_b_note?: string;
}

interface SearchCaseFormValues {
  domain: string;
  scenario_description: string;
  prompt: string;
  timeliness_tag: string;
  model_a_response_text: string;
  model_a_share_link: string;
  model_a_screenshot: string;
  model_b_response_text: string;
  model_b_share_link: string;
  model_b_screenshot: string;
  reference_answer: string;
  rules: SearchCaseRuleFormItem[];
}

interface AiReviewState<T> {
  status: "idle" | "loading" | "done" | "failed";
  result?: T;
  errorMessage?: string;
}

const DEFAULT_SEARCH_CASE_SCHEMA: SingleTurnSearchCaseSchema = {
  plugin_code: "single_turn_search_case",
  plugin_version: "1.0.0",
  page_title: "Single Turn Search Boundary Case",
  sections: [
    "作业说明区",
    "出题信息区",
    "模型一回复录入区",
    "模型二回复录入区",
    "参考答案区",
    "评分规则区",
    "模型评分区",
    "自动统计区",
  ],
  evidence_source_options: ["web_link", "prompt_requirement", "project_document", "none"],
  default_domain_options: ["本地生活", "旅游出行", "消费决策", "教育培训", "健康信息", "科技数码", "工作效率", "其他"],
  default_timeliness_options: ["弱时效", "中时效", "强时效"],
  model_labels: ["模型一", "模型二"],
};

function buildEmptyRule(): SearchCaseRuleFormItem {
  return {
    rule_category: "",
    rule_text: "",
    weight: 1,
    evidence_source_type: "none",
    reference_url: "",
    quote_text: "",
    evidence_screenshot: "",
    optional_note: "",
    model_a_hit: undefined,
    model_a_note: "",
    model_b_hit: undefined,
    model_b_note: "",
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImageUploadField({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileList = useMemo<UploadFile[]>(
    () =>
      value
        ? [
            {
              uid: "uploaded",
              name: "screenshot.png",
              status: "done",
              url: value,
            },
          ]
        : [],
    [value],
  );

  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      <Upload
        accept="image/*"
        listType="picture-card"
        maxCount={1}
        fileList={fileList}
        showUploadList={{ showPreviewIcon: false }}
        beforeUpload={async (file) => {
          setUploading(true);
          try {
            const base64 = await fileToBase64(file);
            onChange?.(base64);
          } catch {
            message.error("截图读取失败，请重试");
          } finally {
            setUploading(false);
          }
          return false;
        }}
        onRemove={() => {
          onChange?.("");
          return true;
        }}
      >
        {!value ? (
          <Space direction="vertical" size={4} align="center">
            <UploadOutlined />
            <span>{uploading ? "处理中" : "上传截图"}</span>
          </Space>
        ) : null}
      </Upload>
      <Input.TextArea
        rows={2}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder="已上传后会自动填入 base64，也可手工粘贴截图数据"
      />
    </Space>
  );
}

function buildSoftChecks(values: Partial<SearchCaseFormValues>, task: SingleTurnSearchCaseTaskItem | null): SearchCaseSoftCheck[] {
  const checks: SearchCaseSoftCheck[] = [];
  const prompt = (values.prompt || "").trim();
  const scenario = (values.scenario_description || "").trim();
  const referenceAnswer = (values.reference_answer || "").trim();
  const rules = values.rules || [];

  if (scenario && scenario.length < 30) {
    checks.push({ code: "scenario_short", level: "warning", message: "场景说明偏短，可能不足以证明题目真实。" });
  }
  if (prompt && prompt.length < 12) {
    checks.push({ code: "prompt_short", level: "warning", message: "Prompt 偏短，建议更口语化并补充真实语境。" });
  }
  if (prompt && !prompt.includes("?") && !prompt.includes("？")) {
    checks.push({ code: "prompt_not_question_like", level: "info", message: "Prompt 看起来不够像自然搜索提问。" });
  }
  if (prompt && ["prove", "tensor", "algorithmic complexity"].some((token) => prompt.toLowerCase().includes(token))) {
    checks.push({ code: "too_professional", level: "warning", message: "Prompt 可能偏专业，建议更接近日常搜索场景。" });
  }
  if ((values.timeliness_tag || "") && values.timeliness_tag !== "弱时效") {
    checks.push({ code: "timeliness_high", level: "info", message: "当前不是弱时效标签，注意确认题目是否稳定且可复查。" });
  }
  if (rules.length > 0 && !rules.some((item) => item.evidence_source_type === "web_link")) {
    checks.push({ code: "missing_web_evidence", level: "warning", message: "评分规则里没有网页文本信源，请确认是否具备可核验依据。" });
  }
  if (referenceAnswer && referenceAnswer.length < 120) {
    checks.push({ code: "reference_answer_brief", level: "warning", message: "参考答案偏短，建议补充完整性和可读性。" });
  }
  if (rules.some((item) => /[;；]|\nand\s|\nor\s|并且|以及/.test(item.rule_text || ""))) {
    checks.push({ code: "rule_atomicity", level: "info", message: "部分评分规则可能包含多个判断点，建议继续拆分。" });
  }
  if (task && rules.length > 0 && rules.length < Math.max(task.scoring_rules_min + 1, 7)) {
    checks.push({ code: "rule_coverage", level: "info", message: "评分规则条数偏少，建议检查覆盖是否完整。" });
  }
  return checks;
}

function buildScorePreview(rules: SearchCaseRuleFormItem[]): SearchCaseScoreSummary {
  const positiveTotal = rules.reduce((sum, item) => sum + (Number(item.weight) > 0 ? Number(item.weight) : 0), 0);
  const modelARaw = Math.max(
    rules.reduce((sum, item) => sum + (item.model_a_hit ? Number(item.weight || 0) : 0), 0),
    0,
  );
  const modelBRaw = Math.max(
    rules.reduce((sum, item) => sum + (item.model_b_hit ? Number(item.weight || 0) : 0), 0),
    0,
  );
  const modelAPercentage = positiveTotal > 0 ? Number(((modelARaw / positiveTotal) * 100).toFixed(2)) : 0;
  const modelBPercentage = positiveTotal > 0 ? Number(((modelBRaw / positiveTotal) * 100).toFixed(2)) : 0;
  const scoreGap = Number(Math.abs(modelAPercentage - modelBPercentage).toFixed(2));
  return {
    positive_total_score: positiveTotal,
    model_a_raw_score: modelARaw,
    model_a_percentage: modelAPercentage,
    model_b_raw_score: modelBRaw,
    model_b_percentage: modelBPercentage,
    score_gap: scoreGap,
    model_a_below_target: modelAPercentage < 50,
    score_gap_exceeds_target: scoreGap > 15,
  };
}

function mapFirstValidationError(field: string): string {
  if (field.includes("domain")) return "题目领域必填";
  if (field.includes("scenario_description")) return "场景说明必填";
  if (field.includes("prompt")) return "Prompt 必填";
  if (field.includes("timeliness_tag")) return "时效性标签必填";
  if (field.includes("reference_answer")) return "参考答案必填";
  if (field.includes("model_a")) return "请补全模型一信息";
  if (field.includes("model_b")) return "请补全模型二信息";
  if (field.includes("scoring_rules")) return "评分规则不满足要求";
  return "请检查提交内容";
}

function buildRuleAiReviewPayload(
  values: Partial<SearchCaseFormValues>,
  currentTask: SingleTurnSearchCaseTaskItem,
  projectId: number,
  rule: SearchCaseRuleFormItem,
  ruleIndex: number,
): SingleTurnSearchCaseAiReviewPayload {
  return {
    project_id: projectId,
    task_id: currentTask.task_id,
    domain: values.domain?.trim() || "",
    scenario_description: values.scenario_description?.trim() || "",
    prompt: values.prompt?.trim() || "",
    timeliness_tag: values.timeliness_tag?.trim() || "",
    model_a: {
      model_name: currentTask.model_a_name,
      response_text: values.model_a_response_text?.trim() || "",
      share_link: values.model_a_share_link?.trim() || "",
      screenshot: values.model_a_screenshot?.trim() || "",
    },
    model_b: {
      model_name: currentTask.model_b_name,
      response_text: values.model_b_response_text?.trim() || "",
      share_link: values.model_b_share_link?.trim() || "",
      screenshot: values.model_b_screenshot?.trim() || "",
    },
    rule: {
      rule_index: ruleIndex,
      rule_category: rule.rule_category?.trim() || "",
      rule_text: rule.rule_text?.trim() || "",
      weight: typeof rule.weight === "number" ? rule.weight : null,
      evidence_source_type: rule.evidence_source_type,
      reference_url: rule.reference_url?.trim() || "",
      quote_text: rule.quote_text?.trim() || "",
      evidence_screenshot: rule.evidence_screenshot?.trim() || "",
      optional_note: rule.optional_note?.trim() || "",
      model_a_human_hit: typeof rule.model_a_hit === "boolean" ? rule.model_a_hit : null,
      model_a_human_note: rule.model_a_note?.trim() || "",
      model_b_human_hit: typeof rule.model_b_hit === "boolean" ? rule.model_b_hit : null,
      model_b_human_note: rule.model_b_note?.trim() || "",
    },
  };
}

function runRuleAiPrecheck(payload: SingleTurnSearchCaseAiReviewPayload): SearchCaseAiReviewMissingField[] {
  const missing: SearchCaseAiReviewMissingField[] = [];
  const ruleIndex = payload.rule.rule_index;

  const addMissing = (field: string, label: string, message = "请先补全当前规则所需内容后再进行模型校验") => {
    missing.push({ field, label, message });
  };

  if (!payload.domain) addMissing("domain", "题目领域");
  if (!payload.timeliness_tag) addMissing("timeliness_tag", "时效性标签");
  if (!payload.scenario_description) addMissing("scenario_description", "场景说明");
  if (!payload.prompt) addMissing("prompt", "Prompt");
  if (!payload.model_a.response_text) addMissing("model_a.response_text", "模型1回答全文");
  if (!payload.model_b.response_text) addMissing("model_b.response_text", "模型2回答全文");
  if (!payload.rule.rule_category) addMissing(`rules.${ruleIndex}.rule_category`, "规则分类");
  if (payload.rule.weight === null || payload.rule.weight === undefined) addMissing(`rules.${ruleIndex}.weight`, "权重");
  if (!payload.rule.evidence_source_type) addMissing(`rules.${ruleIndex}.evidence_source_type`, "证据来源");
  if (!payload.rule.rule_text) addMissing(`rules.${ruleIndex}.rule_text`, "规则内容");

  if (payload.rule.evidence_source_type === "web_link") {
    if (!payload.rule.reference_url) addMissing(`rules.${ruleIndex}.reference_url`, "参考链接", "网页链接规则必须填写参考链接");
    if (!payload.rule.quote_text) addMissing(`rules.${ruleIndex}.quote_text`, "引用说明", "网页链接规则必须填写引用说明");
    if (!payload.rule.evidence_screenshot) addMissing(`rules.${ruleIndex}.evidence_screenshot`, "证据截图", "网页链接规则必须上传证据截图");
  } else if (
    payload.rule.evidence_source_type === "prompt_requirement" ||
    payload.rule.evidence_source_type === "project_document"
  ) {
    if (!payload.rule.quote_text && !payload.rule.optional_note) {
      addMissing(`rules.${ruleIndex}.quote_text`, "引用说明/补充说明", "请至少填写引用说明或补充说明，以说明当前规则依据");
    }
  } else if (payload.rule.evidence_source_type === "none") {
    if (!payload.rule.quote_text && !payload.rule.optional_note) {
      addMissing(`rules.${ruleIndex}.quote_text`, "引用说明/补充说明", "证据来源为无时，请补充说明为什么该规则成立");
    }
  }

  if (payload.rule.model_a_human_hit === null || payload.rule.model_a_human_hit === undefined) {
    addMissing(`rules.${ruleIndex}.model_a_hit`, "模型1人工判定");
  }
  if (!payload.rule.model_a_human_note) addMissing(`rules.${ruleIndex}.model_a_note`, "模型1人工备注");
  if (payload.rule.model_b_human_hit === null || payload.rule.model_b_human_hit === undefined) {
    addMissing(`rules.${ruleIndex}.model_b_hit`, "模型2人工判定");
  }
  if (!payload.rule.model_b_human_note) addMissing(`rules.${ruleIndex}.model_b_note`, "模型2人工备注");

  return missing;
}

function getRuleAiStatusTag(state?: AiReviewState<any>) {
  if (!state || state.status === "idle") {
    return <Tag>未校验</Tag>;
  }
  if (state.status === "loading") {
    return <Tag color="processing">校验中</Tag>;
  }
  if (state.status === "done") {
    return <Tag color="success">已完成</Tag>;
  }
  return <Tag color="error">校验失败</Tag>;
}

function runRuleDefinitionPrecheck(payload: SingleTurnSearchCaseAiReviewPayload): SearchCaseAiReviewMissingField[] {
  const missing: SearchCaseAiReviewMissingField[] = [];
  const ruleIndex = payload.rule.rule_index;

  const addMissing = (field: string, label: string, message = "请先补全当前规则所需内容后再进行模型校验") => {
    missing.push({ field, label, message });
  };

  if (!payload.domain) addMissing("domain", "题目领域");
  if (!payload.timeliness_tag) addMissing("timeliness_tag", "时效性标签");
  if (!payload.scenario_description) addMissing("scenario_description", "场景说明");
  if (!payload.prompt) addMissing("prompt", "Prompt");
  if (!payload.rule.rule_category) addMissing(`rules.${ruleIndex}.rule_category`, "规则分类");
  if (payload.rule.weight === null || payload.rule.weight === undefined) addMissing(`rules.${ruleIndex}.weight`, "权重");
  if (!payload.rule.evidence_source_type) addMissing(`rules.${ruleIndex}.evidence_source_type`, "证据来源");
  if (!payload.rule.rule_text) addMissing(`rules.${ruleIndex}.rule_text`, "规则内容");

  if (payload.rule.evidence_source_type === "web_link") {
    if (!payload.rule.reference_url) addMissing(`rules.${ruleIndex}.reference_url`, "参考链接", "网页链接规则必须填写参考链接");
    if (!payload.rule.quote_text) addMissing(`rules.${ruleIndex}.quote_text`, "引用说明", "网页链接规则必须填写引用说明");
    if (!payload.rule.evidence_screenshot) addMissing(`rules.${ruleIndex}.evidence_screenshot`, "证据截图", "网页链接规则必须上传证据截图");
  } else if (
    payload.rule.evidence_source_type === "prompt_requirement" ||
    payload.rule.evidence_source_type === "project_document"
  ) {
    if (!payload.rule.quote_text && !payload.rule.optional_note) {
      addMissing(`rules.${ruleIndex}.quote_text`, "引用说明/补充说明", "请至少填写引用说明或补充说明，以说明当前规则依据");
    }
  } else if (payload.rule.evidence_source_type === "none") {
    if (!payload.rule.quote_text && !payload.rule.optional_note) {
      addMissing(`rules.${ruleIndex}.quote_text`, "引用说明/补充说明", "证据来源为无时，请补充说明为什么该规则成立");
    }
  }

  return missing;
}

function runModelReviewPrecheck(
  payload: SingleTurnSearchCaseAiReviewPayload,
  targetModel: "model_a" | "model_b",
): SearchCaseAiReviewMissingField[] {
  const missing = runRuleDefinitionPrecheck(payload);
  const ruleIndex = payload.rule.rule_index;

  const addMissing = (field: string, label: string, message = "请先补全当前规则所需内容后再进行模型校验") => {
    missing.push({ field, label, message });
  };

  if (targetModel === "model_a") {
    if (!payload.model_a.response_text) addMissing("model_a.response_text", "模型1回答全文");
    if (payload.rule.model_a_human_hit === null || payload.rule.model_a_human_hit === undefined) {
      addMissing(`rules.${ruleIndex}.model_a_hit`, "模型1人工判定");
    }
    if (!payload.rule.model_a_human_note) addMissing(`rules.${ruleIndex}.model_a_note`, "模型1人工备注");
  } else {
    if (!payload.model_b.response_text) addMissing("model_b.response_text", "模型2回答全文");
    if (payload.rule.model_b_human_hit === null || payload.rule.model_b_human_hit === undefined) {
      addMissing(`rules.${ruleIndex}.model_b_hit`, "模型2人工判定");
    }
    if (!payload.rule.model_b_human_note) addMissing(`rules.${ruleIndex}.model_b_note`, "模型2人工备注");
  }

  return missing;
}

function getAiStatusTag(state?: AiReviewState<unknown>) {
  if (!state || state.status === "idle") {
    return <Tag>未校验</Tag>;
  }
  if (state.status === "loading") {
    return <Tag color="processing">校验中</Tag>;
  }
  if (state.status === "done") {
    return <Tag color="success">已完成</Tag>;
  }
  return <Tag color="error">校验失败</Tag>;
}

function renderPrecheckAlert(missingFields: SearchCaseAiReviewMissingField[], passed: boolean) {
  return (
    <Alert
      type={passed ? "success" : "warning"}
      showIcon
      message={passed ? "完整性检查已通过" : "完整性检查未通过"}
      description={
        passed ? (
          "当前所需字段已补齐，可以基于现有人工填写内容进行 AI 复核。"
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {missingFields.map((item) => (
              <li key={item.field}>{`${item.label}：${item.message}`}</li>
            ))}
          </ul>
        )
      }
    />
  );
}

function renderRuleCheckResult(result?: SingleTurnSearchCaseAiRuleCheckResponse, errorMessage?: string) {
  if (!result && !errorMessage) {
    return null;
  }

  return (
    <Card size="small" style={{ marginTop: 16, background: "#fafcff" }} title="AI 规则复核结果">
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {result ? renderPrecheckAlert(result.precheck.missing_fields, result.precheck.passed) : null}
        {errorMessage ? <Alert type="error" showIcon message="AI 复核失败" description={errorMessage} /> : null}
        {result?.result ? (
          <Card size="small" title="规则复核结果">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Tag color={result.result.status === "pass" ? "success" : result.result.status === "risk" ? "warning" : "error"}>
                {`状态：${result.result.status}`}
              </Tag>
              {result.result.issues.length ? (
                <Typography.Text type="secondary">{`问题标签：${result.result.issues.join(" / ")}`}</Typography.Text>
              ) : null}
              {Object.entries(result.result.checks as Record<string, { passed: boolean; detail: string }>).map(([key, item]) => (
                <Alert key={key} type={item.passed ? "success" : "warning"} showIcon message={key} description={item.detail} />
              ))}
              <Typography.Paragraph style={{ marginBottom: 0 }}>{result.result.reference_advice}</Typography.Paragraph>
              {result.result.extra_suggestions.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {result.result.extra_suggestions.map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </Space>
          </Card>
        ) : null}
      </Space>
    </Card>
  );
}

function renderModelCheckResult(
  title: string,
  result?: SingleTurnSearchCaseAiModelCheckResponse,
  errorMessage?: string,
) {
  if (!result && !errorMessage) {
    return null;
  }

  return (
    <Card size="small" style={{ marginTop: 16, background: "#fafcff" }} title={title}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {result ? renderPrecheckAlert(result.precheck.missing_fields, result.precheck.passed) : null}
        {errorMessage ? <Alert type="error" showIcon message="AI 复核失败" description={errorMessage} /> : null}
        {result?.result ? (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Tag color={result.result.consistency === "consistent" ? "success" : "warning"}>
              {`AI判断 ${result.result.ai_judgement} / 与人工 ${result.result.consistency}`}
            </Tag>
            <Typography.Text>{`人工备注质量：${result.result.remark_quality}`}</Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{result.result.reason}</Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{result.result.reference_advice}</Typography.Paragraph>
            {result.result.extra_suggestions.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.result.extra_suggestions.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </Space>
        ) : null}
      </Space>
    </Card>
  );
}

export function SingleTurnSearchCasePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const projectIdNumber = useMemo(() => Number(projectId), [projectId]);
  const [form] = Form.useForm<SearchCaseFormValues>();
  const [schema, setSchema] = useState<SingleTurnSearchCaseSchema | null>(null);
  const [stats, setStats] = useState<{ total_tasks: number; completed_tasks: number; pending_tasks: number } | null>(null);
  const [currentTask, setCurrentTask] = useState<SingleTurnSearchCaseTaskItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSubmission, setLastSubmission] = useState<SingleTurnSearchCaseSubmissionResult | null>(null);
  const [ruleDefinitionReviews, setRuleDefinitionReviews] = useState<Record<number, AiReviewState<SingleTurnSearchCaseAiRuleCheckResponse>>>({});
  const [modelAReviews, setModelAReviews] = useState<Record<number, AiReviewState<SingleTurnSearchCaseAiModelCheckResponse>>>({});
  const [modelBReviews, setModelBReviews] = useState<Record<number, AiReviewState<SingleTurnSearchCaseAiModelCheckResponse>>>({});
  const ruleAiReviews: Record<number, AiReviewState<any>> = {};
  const requestIdRef = useRef(0);

  const watchedRules = Form.useWatch("rules", form);
  const rules = Array.isArray(watchedRules) ? watchedRules : [];
  const liveValues = (Form.useWatch([], form) ?? {}) as Partial<SearchCaseFormValues>;
  const softChecks = useMemo(() => buildSoftChecks(liveValues, currentTask), [liveValues, currentTask]);
  const scorePreview = useMemo(() => buildScorePreview(rules), [rules]);

  const resetPageState = () => {
    setSchema(DEFAULT_SEARCH_CASE_SCHEMA);
    setStats(null);
    setCurrentTask(null);
    setLoadError(null);
    setLastSubmission(null);
    setRuleDefinitionReviews({});
    setModelAReviews({});
    setModelBReviews({});
    form.resetFields();
  };

  const loadPageData = async ({ silent = false }: { silent?: boolean } = {}) => {
    const requestId = ++requestIdRef.current;
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      setLoadError("项目参数不正确");
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [statsData, taskData] = await Promise.all([
        fetchSingleTurnSearchCaseProjectStats(projectIdNumber),
        fetchSingleTurnSearchCaseCurrentTask(projectIdNumber),
      ]);
      if (requestId !== requestIdRef.current) {
        return;
      }

      setStats(statsData);
      setCurrentTask(taskData);

      if (taskData) {
        form.setFieldsValue({
          domain: taskData.domain_options[0] ?? DEFAULT_SEARCH_CASE_SCHEMA.default_domain_options[0],
          timeliness_tag: taskData.timeliness_options[0] ?? DEFAULT_SEARCH_CASE_SCHEMA.default_timeliness_options[0],
          rules: Array.from({ length: taskData.scoring_rules_min }, () => buildEmptyRule()),
          model_a_screenshot: "",
          model_b_screenshot: "",
        });
      } else {
        form.resetFields();
      }

      try {
        const schemaData = await fetchSingleTurnSearchCaseSchema();
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSchema(schemaData);
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSchema(DEFAULT_SEARCH_CASE_SCHEMA);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "加载 case 任务失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(errorMessage);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    resetPageState();
    void loadPageData({ silent: true });
    return () => {
      requestIdRef.current += 1;
    };
  }, [projectIdNumber]);

  const handleRuleDefinitionReview = async (ruleIndex: number) => {
    if (!currentTask || Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      message.error("当前没有可校验的规则");
      return;
    }

    const values = (form.getFieldsValue(true) ?? {}) as Partial<SearchCaseFormValues>;
    const currentRules = Array.isArray(values.rules) ? values.rules : [];
    const currentRule = currentRules[ruleIndex];
    if (!currentRule) {
      message.error("当前规则不存在");
      return;
    }

    const payload = buildRuleAiReviewPayload(values, currentTask, projectIdNumber, currentRule, ruleIndex);
    const precheckMissing = runRuleDefinitionPrecheck(payload);
    if (precheckMissing.length > 0) {
      setRuleDefinitionReviews((previous) => ({
        ...previous,
        [ruleIndex]: {
          status: "failed",
          result: {
            ok: true,
            precheck: {
              passed: false,
              missing_fields: precheckMissing,
            },
            result: null,
          },
        },
      }));
      message.warning("请先补全当前规则所需内容后再进行模型校验");
      return;
    }

    setRuleDefinitionReviews((previous) => ({
      ...previous,
      [ruleIndex]: {
        ...previous[ruleIndex],
        status: "loading",
        errorMessage: undefined,
      },
    }));

    try {
      const result = await reviewSingleTurnSearchCaseRuleDefinitionWithAi(projectIdNumber, payload);
      setRuleDefinitionReviews((previous) => ({
        ...previous,
        [ruleIndex]: {
          status: result.ok ? "done" : "failed",
          result,
          errorMessage: result.error_message || undefined,
        },
      }));
      if (!result.ok && result.error_message) {
        message.error(result.error_message);
        return;
      }
      if (!result.precheck.passed) {
        message.warning("请先补全当前规则所需内容后再进行模型校验");
        return;
      }
      message.success("规则 AI 复核已完成");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "规则 AI 复核失败";
      setRuleDefinitionReviews((previous) => ({
        ...previous,
        [ruleIndex]: {
          ...previous[ruleIndex],
          status: "failed",
          errorMessage,
        },
      }));
      message.error(errorMessage);
    }
  };

  const handleModelReview = async (ruleIndex: number, targetModel: "model_a" | "model_b") => {
    if (!currentTask || Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      message.error("当前没有可校验的规则");
      return;
    }

    const values = (form.getFieldsValue(true) ?? {}) as Partial<SearchCaseFormValues>;
    const currentRules = Array.isArray(values.rules) ? values.rules : [];
    const currentRule = currentRules[ruleIndex];
    if (!currentRule) {
      message.error("当前规则不存在");
      return;
    }

    const payload = buildRuleAiReviewPayload(values, currentTask, projectIdNumber, currentRule, ruleIndex);
    const precheckMissing = runModelReviewPrecheck(payload, targetModel);
    const setReviewState = targetModel === "model_a" ? setModelAReviews : setModelBReviews;
    const reviewLabel = targetModel === "model_a" ? "模型1" : "模型2";

    if (precheckMissing.length > 0) {
      setReviewState((previous) => ({
        ...previous,
        [ruleIndex]: {
          status: "failed",
          result: {
            ok: true,
            precheck: {
              passed: false,
              missing_fields: precheckMissing,
            },
            result: null,
          },
        },
      }));
      message.warning("请先补全当前规则所需内容后再进行模型校验");
      return;
    }

    setReviewState((previous) => ({
      ...previous,
      [ruleIndex]: {
        ...previous[ruleIndex],
        status: "loading",
        errorMessage: undefined,
      },
    }));

    try {
      const result =
        targetModel === "model_a"
          ? await reviewSingleTurnSearchCaseModelAWithAi(projectIdNumber, payload)
          : await reviewSingleTurnSearchCaseModelBWithAi(projectIdNumber, payload);
      setReviewState((previous) => ({
        ...previous,
        [ruleIndex]: {
          status: result.ok ? "done" : "failed",
          result,
          errorMessage: result.error_message || undefined,
        },
      }));
      if (!result.ok && result.error_message) {
        message.error(result.error_message);
        return;
      }
      if (!result.precheck.passed) {
        message.warning("请先补全当前规则所需内容后再进行模型校验");
        return;
      }
      message.success(`${reviewLabel} AI 复核已完成`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `${reviewLabel} AI 复核失败`;
      setReviewState((previous) => ({
        ...previous,
        [ruleIndex]: {
          ...previous[ruleIndex],
          status: "failed",
          errorMessage,
        },
      }));
      message.error(errorMessage);
    }
  };

  const handleRuleAiReview = async (ruleIndex: number) => {
    await handleRuleDefinitionReview(ruleIndex);
  };

  const handleSubmit = async (values: SearchCaseFormValues) => {
    if (!currentTask || Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      message.error("当前没有可提交的任务模板");
      return;
    }

    const scoringRules: SearchCaseRuleInput[] = (values.rules || []).map((item) => ({
      rule_category: item.rule_category,
      rule_text: item.rule_text,
      weight: Number(item.weight || 0),
      evidence_source_type: item.evidence_source_type,
      reference_url: item.reference_url || null,
      quote_text: item.quote_text || null,
      evidence_screenshot: item.evidence_screenshot || null,
      optional_note: item.optional_note || null,
    }));
    const modelAEvaluations: SearchCaseRuleEvaluation[] = (values.rules || []).map((item, index) => ({
      rule_index: index,
      hit: Boolean(item.model_a_hit),
      note: item.model_a_note || "",
    }));
    const modelBEvaluations: SearchCaseRuleEvaluation[] = (values.rules || []).map((item, index) => ({
      rule_index: index,
      hit: Boolean(item.model_b_hit),
      note: item.model_b_note || "",
    }));

    const modelA: SearchCaseModelAnswer = {
      model_name: currentTask.model_a_name,
      response_text: values.model_a_response_text,
      share_link: values.model_a_share_link,
      screenshot: values.model_a_screenshot,
    };
    const modelB: SearchCaseModelAnswer = {
      model_name: currentTask.model_b_name,
      response_text: values.model_b_response_text,
      share_link: values.model_b_share_link,
      screenshot: values.model_b_screenshot,
    };

    const payload: SingleTurnSearchCaseSubmissionPayload = {
      project_id: projectIdNumber,
      task_id: currentTask.task_id,
      annotator_id: null,
      domain: values.domain,
      scenario_description: values.scenario_description,
      prompt: values.prompt,
      timeliness_tag: values.timeliness_tag,
      model_a: modelA,
      model_b: modelB,
      reference_answer: values.reference_answer,
      scoring_rules: scoringRules,
      model_a_evaluations: modelAEvaluations,
      model_b_evaluations: modelBEvaluations,
    };

    setSubmitting(true);
    try {
      const validation = await validateSingleTurnSearchCaseSubmission(projectIdNumber, payload);
      if (!validation.valid) {
        const firstIssue = validation.errors[0];
        message.error(firstIssue ? mapFirstValidationError(firstIssue.field) : "提交内容未通过校验");
        return;
      }
      const result = await submitSingleTurnSearchCaseSubmission(projectIdNumber, payload);
      setLastSubmission(result);
      message.success("Case 已提交");
      await loadPageData({ silent: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "提交 case 失败";
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div className="search-case-page">
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          {loadError ? <Alert type="warning" showIcon message="加载任务失败" description={loadError} /> : null}

          <Card
            className="search-case-card"
            title="作业说明区"
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => void loadPageData()} loading={loading}>
                刷新任务
              </Button>
            }
          >
            {currentTask ? (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {currentTask.task_name}
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {currentTask.task_description || "当前模板没有额外说明。"}
                </Typography.Paragraph>
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                  {currentTask.instruction_text || "请围绕真实、可搜索、可核验的单轮搜索问题生产完整 case。"}
                </Typography.Paragraph>
                {currentTask.show_case_guidance ? (
                  <Alert
                    type="info"
                    showIcon
                    message="Good case / Bad case 提示"
                    description="建议选择真实、日常、带弱时效性的搜索场景；避免纯知识题、极强时效题和答案边界无法穷举的开放题。"
                  />
                ) : null}
                <Space wrap>
                  <Tag color="blue">{`模板规则范围 ${currentTask.scoring_rules_min}-${currentTask.scoring_rules_max}`}</Tag>
                  <Tag color="gold">{`最少扣分项 ${currentTask.min_penalty_rules}`}</Tag>
                  <Tag>{`进度 ${stats?.completed_tasks ?? 0}/${stats?.total_tasks ?? 0}`}</Tag>
                </Space>
              </Space>
            ) : (
              <Empty description="当前项目暂无待处理模板" />
            )}
          </Card>

          {lastSubmission ? (
            <Alert
              type="success"
              showIcon
              message={`最近一次提交成功，记录编号 ${lastSubmission.submission_id}`}
              description={`模型一 ${lastSubmission.score_summary.model_a_percentage}% / 模型二 ${lastSubmission.score_summary.model_b_percentage}% / 分差 ${lastSubmission.score_summary.score_gap}%`}
            />
          ) : null}

          {!currentTask ? null : (
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Space direction="vertical" size={18} style={{ width: "100%" }}>
                <Card className="search-case-card" title="出题信息区">
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item label="题目领域" name="domain" rules={[{ required: true, message: "请选择题目领域" }]}>
                        <Select options={currentTask.domain_options.map((item) => ({ label: item, value: item }))} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="时效性标签" name="timeliness_tag" rules={[{ required: true, message: "请选择时效性标签" }]}>
                        <Select options={currentTask.timeliness_options.map((item) => ({ label: item, value: item }))} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="场景说明" name="scenario_description" rules={[{ required: true, message: "请输入场景说明" }]}>
                    <Input.TextArea rows={4} placeholder="说明为什么这是一个真实、日常的搜索场景" />
                  </Form.Item>
                  <Form.Item label="Prompt" name="prompt" rules={[{ required: true, message: "请输入 Prompt" }]}>
                    <Input.TextArea rows={4} placeholder="请输入最终给模型的搜索型 Prompt" />
                  </Form.Item>
                </Card>

                <Row gutter={[18, 18]}>
                  <Col xs={24} xl={12}>
                    <Card className="search-case-card" title="模型一回复录入区">
                      <Typography.Paragraph type="secondary">{currentTask.model_a_name}</Typography.Paragraph>
                      <Form.Item
                        label="回复全文"
                        name="model_a_response_text"
                        rules={[{ required: true, message: "请输入模型一回复全文" }]}
                      >
                        <Input.TextArea rows={8} />
                      </Form.Item>
                      <Form.Item
                        label="分享链接"
                        name="model_a_share_link"
                        rules={[{ required: currentTask.require_share_link, message: "请输入模型一分享链接" }]}
                      >
                        <Input placeholder="请输入模型一分享链接" />
                      </Form.Item>
                      <Form.Item
                        label="截图上传"
                        name="model_a_screenshot"
                        rules={[{ required: currentTask.require_model_screenshot, message: "请上传模型一截图" }]}
                      >
                        <ImageUploadField />
                      </Form.Item>
                    </Card>
                  </Col>
                  <Col xs={24} xl={12}>
                    <Card className="search-case-card" title="模型二回复录入区">
                      <Typography.Paragraph type="secondary">{currentTask.model_b_name}</Typography.Paragraph>
                      <Form.Item
                        label="回复全文"
                        name="model_b_response_text"
                        rules={[{ required: true, message: "请输入模型二回复全文" }]}
                      >
                        <Input.TextArea rows={8} />
                      </Form.Item>
                      <Form.Item
                        label="分享链接"
                        name="model_b_share_link"
                        rules={[{ required: currentTask.require_share_link, message: "请输入模型二分享链接" }]}
                      >
                        <Input placeholder="请输入模型二分享链接" />
                      </Form.Item>
                      <Form.Item
                        label="截图上传"
                        name="model_b_screenshot"
                        rules={[{ required: currentTask.require_model_screenshot, message: "请上传模型二截图" }]}
                      >
                        <ImageUploadField />
                      </Form.Item>
                    </Card>
                  </Col>
                </Row>

                <Card className="search-case-card" title="参考答案区">
                  <Form.Item label="参考答案" name="reference_answer" rules={[{ required: true, message: "请输入参考答案" }]} style={{ marginBottom: 0 }}>
                    <Input.TextArea rows={8} placeholder="请给出可读、完整、便于核验的参考答案" />
                  </Form.Item>
                </Card>

                <Card
                  className="search-case-card"
                  title="评分规则区"
                  extra={
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const currentRules = form.getFieldValue("rules") || [];
                        form.setFieldValue("rules", [...currentRules, buildEmptyRule()]);
                      }}
                    >
                      新增规则
                    </Button>
                  }
                >
                  <Form.List name="rules">
                    {(fields, { remove }) => (
                      <Space direction="vertical" size={16} style={{ width: "100%" }}>
                        {fields.map((field, index) => (
                          <Card
                            key={field.key}
                            type="inner"
                            title={`规则 ${index + 1}`}
                            extra={
                              fields.length > currentTask.scoring_rules_min ? (
                                <Button danger type="link" onClick={() => remove(field.name)}>
                                  删除
                                </Button>
                              ) : null
                            }
                          >
                            <Space align="center" size={8} style={{ marginBottom: 16 }}>
                              {getAiStatusTag(ruleDefinitionReviews[index])}
                              <Button size="small" onClick={() => void handleRuleDefinitionReview(index)}>
                                规则校验
                              </Button>
                            </Space>
                            <Row gutter={16}>
                              <Col xs={24} md={8}>
                                <Form.Item
                                  label="规则分类"
                                  name={[field.name, "rule_category"]}
                                  rules={[{ required: true, message: "请输入规则分类" }]}
                                >
                                  <Input placeholder="如：事实性 / 完整性 / 风险控制" />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={8}>
                                <Form.Item
                                  label="权重"
                                  name={[field.name, "weight"]}
                                  rules={[{ required: true, message: "请输入权重" }]}
                                >
                                  <InputNumber min={-20} max={20} step={1} style={{ width: "100%" }} />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={8}>
                                <Form.Item
                                  label="证据来源"
                                  name={[field.name, "evidence_source_type"]}
                                  rules={[{ required: true, message: "请选择证据来源" }]}
                                >
                                  <Select
                                    options={(schema?.evidence_source_options || []).map((item) => ({
                                      label:
                                        item === "web_link"
                                          ? "网页链接"
                                          : item === "prompt_requirement"
                                            ? "题目要求"
                                            : item === "project_document"
                                              ? "项目说明文档要求"
                                              : "无",
                                      value: item,
                                    }))}
                                  />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Form.Item
                              label="规则内容"
                              name={[field.name, "rule_text"]}
                              rules={[{ required: true, message: "请输入规则内容" }]}
                            >
                              <Input.TextArea rows={3} placeholder="每条规则只写一个独立考点" />
                            </Form.Item>
                            <Row gutter={16}>
                              <Col xs={24} md={12}>
                                <Form.Item label="参考链接" name={[field.name, "reference_url"]}>
                                  <Input placeholder="可选" />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={12}>
                                <Form.Item label="引用说明" name={[field.name, "quote_text"]}>
                                  <Input placeholder="可选" />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Row gutter={16}>
                              <Col xs={24} md={12}>
                                <Form.Item label="证据截图" name={[field.name, "evidence_screenshot"]}>
                                  <ImageUploadField />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={12}>
                                <Form.Item label="补充说明" name={[field.name, "optional_note"]}>
                                  <Input.TextArea rows={4} placeholder="可选" />
                                </Form.Item>
                              </Col>
                            </Row>
                            {renderRuleCheckResult(
                              ruleDefinitionReviews[index]?.result,
                              ruleDefinitionReviews[index]?.errorMessage,
                            )}
                            <Row gutter={[16, 16]}>
                              <Col xs={24} xl={12}>
                                <Card
                                  size="small"
                                  title={`${currentTask.model_a_name} 评分`}
                                  extra={
                                    <Space size={8}>
                                      {getAiStatusTag(modelAReviews[index])}
                                      <Button size="small" onClick={() => void handleModelReview(index, "model_a")}>
                                        模型1校验
                                      </Button>
                                    </Space>
                                  }
                                >
                                  <Form.Item
                                    label="是否命中"
                                    name={[field.name, "model_a_hit"]}
                                    rules={[{ required: true, message: "请选择模型一判定结果" }]}
                                  >
                                    <Radio.Group
                                      options={[
                                        { label: "Yes", value: true },
                                        { label: "No", value: false },
                                      ]}
                                    />
                                  </Form.Item>
                                  <Form.Item
                                    label="备注"
                                    name={[field.name, "model_a_note"]}
                                    rules={[{ required: true, message: "请输入模型一备注" }]}
                                  >
                                    <Input.TextArea rows={3} />
                                  </Form.Item>
                                  {renderModelCheckResult(
                                    `${currentTask.model_a_name} AI 复核结果`,
                                    modelAReviews[index]?.result,
                                    modelAReviews[index]?.errorMessage,
                                  )}
                                </Card>
                              </Col>
                              <Col xs={24} xl={12}>
                                <Card
                                  size="small"
                                  title={`${currentTask.model_b_name} 评分`}
                                  extra={
                                    <Space size={8}>
                                      {getAiStatusTag(modelBReviews[index])}
                                      <Button size="small" onClick={() => void handleModelReview(index, "model_b")}>
                                        模型2校验
                                      </Button>
                                    </Space>
                                  }
                                >
                                  <Form.Item
                                    label="是否命中"
                                    name={[field.name, "model_b_hit"]}
                                    rules={[{ required: true, message: "请选择模型二判定结果" }]}
                                  >
                                    <Radio.Group
                                      options={[
                                        { label: "Yes", value: true },
                                        { label: "No", value: false },
                                      ]}
                                    />
                                  </Form.Item>
                                  <Form.Item
                                    label="备注"
                                    name={[field.name, "model_b_note"]}
                                    rules={[{ required: true, message: "请输入模型二备注" }]}
                                  >
                                    <Input.TextArea rows={3} />
                                  </Form.Item>
                                  {renderModelCheckResult(
                                    `${currentTask.model_b_name} AI 复核结果`,
                                    modelBReviews[index]?.result,
                                    modelBReviews[index]?.errorMessage,
                                  )}
                                </Card>
                              </Col>
                            </Row>
                            {ruleAiReviews[index]?.result ? (
                              <Card size="small" style={{ marginTop: 16, background: "#fafcff" }} title="AI复核结果">
                                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                                  <Alert
                                    type={ruleAiReviews[index]?.result?.precheck.passed ? "success" : "warning"}
                                    showIcon
                                    message={ruleAiReviews[index]?.result?.precheck.passed ? "完整性检查已通过" : "完整性检查未通过"}
                                    description={
                                      ruleAiReviews[index]?.result?.precheck.passed
                                        ? "当前规则相关必填信息已齐全，可以基于现有填写内容进行 AI 复核。"
                                        : (
                                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                                              {ruleAiReviews[index]?.result?.precheck.missing_fields.map((item: SearchCaseAiReviewMissingField) => (
                                                <li key={item.field}>{`${item.label}：${item.message}`}</li>
                                              ))}
                                            </ul>
                                          )
                                    }
                                  />
                                  {ruleAiReviews[index]?.errorMessage ? (
                                    <Alert type="error" showIcon message="AI 复核失败" description={ruleAiReviews[index]?.errorMessage} />
                                  ) : null}
                                  {ruleAiReviews[index]?.result?.review_result ? (
                                    <Alert
                                      type={
                                        ruleAiReviews[index]?.result?.review_result?.overall_status === "pass"
                                          ? "success"
                                          : ruleAiReviews[index]?.result?.review_result?.overall_status === "risk"
                                            ? "warning"
                                            : "error"
                                      }
                                      showIcon
                                      message={`整体结论：${ruleAiReviews[index]?.result?.review_result?.overall_status}`}
                                      description={ruleAiReviews[index]?.result?.review_result?.summary}
                                    />
                                  ) : null}
                                  {ruleAiReviews[index]?.result?.rule_review ? (
                                    <Card size="small" title="规则复核结果">
                                      <Space direction="vertical" size={8} style={{ width: "100%" }}>
                                        <Tag
                                          color={
                                            ruleAiReviews[index]?.result?.rule_review?.status === "pass"
                                              ? "success"
                                              : ruleAiReviews[index]?.result?.rule_review?.status === "risk"
                                                ? "warning"
                                                : "error"
                                          }
                                        >
                                          {`状态：${ruleAiReviews[index]?.result?.rule_review?.status}`}
                                        </Tag>
                                        {ruleAiReviews[index]?.result?.rule_review?.issues.length ? (
                                          <Typography.Text type="secondary">
                                            {`问题标签：${ruleAiReviews[index]?.result?.rule_review?.issues.join(" / ")}`}
                                          </Typography.Text>
                                        ) : null}
                                        {Object.entries(
                                          (ruleAiReviews[index]?.result?.rule_review?.checks ?? {}) as Record<string, { passed: boolean; detail: string }>,
                                        ).map(([key, item]) => (
                                          <Alert key={key} type={item.passed ? "success" : "warning"} showIcon message={key} description={item.detail} />
                                        ))}
                                        <Typography.Paragraph style={{ marginBottom: 0 }}>
                                          {ruleAiReviews[index]?.result?.rule_review?.reference_advice}
                                        </Typography.Paragraph>
                                        {(ruleAiReviews[index]?.result?.rule_review?.extra_suggestions ?? []).length ? (
                                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                                            {ruleAiReviews[index]?.result?.rule_review?.extra_suggestions.map((item: string) => (
                                              <li key={item}>{item}</li>
                                            ))}
                                          </ul>
                                        ) : null}
                                      </Space>
                                    </Card>
                                  ) : null}
                                  {ruleAiReviews[index]?.result?.model_1_review ? (
                                    <Card size="small" title={`${currentTask.model_a_name} 复核结果`}>
                                      <Space direction="vertical" size={8} style={{ width: "100%" }}>
                                        <Tag color={ruleAiReviews[index]?.result?.model_1_review?.consistency === "consistent" ? "success" : "warning"}>
                                          {`AI判断 ${ruleAiReviews[index]?.result?.model_1_review?.ai_judgement} / 与人工 ${ruleAiReviews[index]?.result?.model_1_review?.consistency}`}
                                        </Tag>
                                        <Typography.Text>{`人工备注质量：${ruleAiReviews[index]?.result?.model_1_review?.remark_quality}`}</Typography.Text>
                                        <Typography.Paragraph style={{ marginBottom: 0 }}>
                                          {ruleAiReviews[index]?.result?.model_1_review?.reason}
                                        </Typography.Paragraph>
                                        <Typography.Paragraph style={{ marginBottom: 0 }}>
                                          {ruleAiReviews[index]?.result?.model_1_review?.reference_advice}
                                        </Typography.Paragraph>
                                        {(ruleAiReviews[index]?.result?.model_1_review?.extra_suggestions ?? []).length ? (
                                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                                            {ruleAiReviews[index]?.result?.model_1_review?.extra_suggestions.map((item: string) => (
                                              <li key={item}>{item}</li>
                                            ))}
                                          </ul>
                                        ) : null}
                                      </Space>
                                    </Card>
                                  ) : null}
                                  {ruleAiReviews[index]?.result?.model_2_review ? (
                                    <Card size="small" title={`${currentTask.model_b_name} 复核结果`}>
                                      <Space direction="vertical" size={8} style={{ width: "100%" }}>
                                        <Tag color={ruleAiReviews[index]?.result?.model_2_review?.consistency === "consistent" ? "success" : "warning"}>
                                          {`AI判断 ${ruleAiReviews[index]?.result?.model_2_review?.ai_judgement} / 与人工 ${ruleAiReviews[index]?.result?.model_2_review?.consistency}`}
                                        </Tag>
                                        <Typography.Text>{`人工备注质量：${ruleAiReviews[index]?.result?.model_2_review?.remark_quality}`}</Typography.Text>
                                        <Typography.Paragraph style={{ marginBottom: 0 }}>
                                          {ruleAiReviews[index]?.result?.model_2_review?.reason}
                                        </Typography.Paragraph>
                                        <Typography.Paragraph style={{ marginBottom: 0 }}>
                                          {ruleAiReviews[index]?.result?.model_2_review?.reference_advice}
                                        </Typography.Paragraph>
                                        {(ruleAiReviews[index]?.result?.model_2_review?.extra_suggestions ?? []).length ? (
                                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                                            {ruleAiReviews[index]?.result?.model_2_review?.extra_suggestions.map((item: string) => (
                                              <li key={item}>{item}</li>
                                            ))}
                                          </ul>
                                        ) : null}
                                      </Space>
                                    </Card>
                                  ) : null}
                                </Space>
                              </Card>
                            ) : null}
                          </Card>
                        ))}
                      </Space>
                    )}
                  </Form.List>
                </Card>

                <Card className="search-case-card" title="自动统计区">
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12} xl={8}>
                      <Card size="small">
                        <Typography.Text type="secondary">正分总分</Typography.Text>
                        <Typography.Title level={3}>{scorePreview.positive_total_score}</Typography.Title>
                      </Card>
                    </Col>
                    <Col xs={24} md={12} xl={8}>
                      <Card size="small">
                        <Typography.Text type="secondary">模型一</Typography.Text>
                        <Typography.Title level={3}>{`${scorePreview.model_a_raw_score} / ${scorePreview.model_a_percentage}%`}</Typography.Title>
                      </Card>
                    </Col>
                    <Col xs={24} md={12} xl={8}>
                      <Card size="small">
                        <Typography.Text type="secondary">模型二</Typography.Text>
                        <Typography.Title level={3}>{`${scorePreview.model_b_raw_score} / ${scorePreview.model_b_percentage}%`}</Typography.Title>
                      </Card>
                    </Col>
                  </Row>
                  <Space wrap style={{ marginTop: 16 }}>
                    <Tag color={scorePreview.model_a_below_target ? "red" : "green"}>
                      {scorePreview.model_a_below_target ? "模型一低于 50%" : "模型一达到 50%"}
                    </Tag>
                    <Tag color={scorePreview.score_gap_exceeds_target ? "orange" : "green"}>
                      {scorePreview.score_gap_exceeds_target ? "两模型分差超过 15%" : "两模型分差在阈值内"}
                    </Tag>
                    <Tag>{`分差 ${scorePreview.score_gap}%`}</Tag>
                    <Tag>{`扣分项 ${rules.filter((item) => Number(item.weight || 0) < 0).length}`}</Tag>
                  </Space>
                  <div style={{ marginTop: 16 }}>
                    <Typography.Title level={5}>软校验 / 预检提示</Typography.Title>
                    {softChecks.length === 0 ? (
                      <Alert type="success" showIcon message="当前未发现明显软风险提示" />
                    ) : (
                      <Space direction="vertical" size={10} style={{ width: "100%" }}>
                        {softChecks.map((item) => (
                          <Alert
                            key={item.code}
                            type={item.level === "warning" ? "warning" : "info"}
                            showIcon
                            icon={<InfoCircleOutlined />}
                            message={item.message}
                          />
                        ))}
                      </Space>
                    )}
                  </div>
                </Card>

                <Button type="primary" htmlType="submit" size="large" icon={<SendOutlined />} loading={submitting}>
                  提交完整 Case
                </Button>
              </Space>
            </Form>
          )}
        </Space>
      </div>
    </Spin>
  );
}
