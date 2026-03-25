import { ArrowLeftOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  fetchModelResponseReviewRubric,
  fetchModelResponseReviewSchema,
  fetchMyProjectCurrentReviewTask,
  fetchMyProjectDetail,
  submitMyProjectReviewTask,
} from "../../services/api";
import type {
  ModelResponseReviewRubric,
  ModelResponseReviewSchema,
  ModelResponseReviewSubmissionRecord,
  ProjectItem,
  ProjectTaskReviewAnnotationItem,
  ProjectTaskReviewItem,
  ProjectTaskReviewSubmitPayload,
  ProjectTaskReviewTaskDetail,
  SingleTurnSearchCaseSubmissionDetail,
} from "../../types/api";
import {
  buildModelResponseReviewCommentMap,
  MODEL_RESPONSE_REVIEW_COMMENT_SECTIONS,
  ModelResponseReviewCommentDrawer,
  ModelResponseReviewSectionCard,
  type ModelResponseReviewCommentSectionKey,
} from "./modelResponseReviewWorkspace";
import {
  buildSingleTurnSearchCaseCommentMap,
  SINGLE_TURN_SEARCH_CASE_COMMENT_SECTIONS,
  SingleTurnSearchCaseCommentDrawer,
  type SingleTurnSearchCaseCommentSectionKey,
} from "./singleTurnSearchCaseReviewWorkspace";

interface ReviewFormValues {
  review_result: "pass" | "reject";
  review_comment: string;
}

const DEFAULT_MRR_SCHEMA: ModelResponseReviewSchema = {
  plugin_code: "model_response_review",
  plugin_version: "1.0.0",
  page_title: "Model Response Review",
  sections: ["Task Category", "Prompt", "Model Response", "Review Rubric", "Answer Rating", "Rating Rationale"],
  task_category_options: [
    "Academic Writing",
    "Summarization",
    "Question Answering",
    "Translation",
    "Code Explanation",
    "Content Moderation",
    "Style Rewriting",
    "Other",
  ],
  answer_rating_options: ["Gold Response", "Good Response", "Average Response", "Poor Response"],
  rating_reason_placeholder: "Explain the main reason for your rating.",
};

const DEFAULT_MRR_RUBRIC: ModelResponseReviewRubric = {
  title: "Model Response Review",
  version: "v1",
  intro: "Review the answer quality and explain the main reason for your decision.",
  levels: [
    { rating: "Gold Response", guidance: "Accurate, complete, well-structured, and directly useful." },
    { rating: "Good Response", guidance: "Mostly correct and useful, with only minor issues." },
    { rating: "Average Response", guidance: "Partially useful but incomplete, vague, or uneven." },
    { rating: "Poor Response", guidance: "Incorrect, unsafe, or not meaningfully useful." },
  ],
  review_notes: [
    "Focus on answer quality rather than writing style alone.",
    "Use the rationale field to explain the main strengths or flaws.",
  ],
};

function getTaskStatusText(status: string): string {
  if (status === "review_pending") return "待领取";
  if (status === "review_in_progress") return "质检中";
  if (status === "review_submitted") return "待管理员处理";
  if (status === "pending_review_dispatch") return "待发起质检";
  if (status === "approved") return "已通过";
  if (status === "annotation_in_progress") return "已打回标注";
  return status;
}

function getReviewStatusText(status: string): string {
  if (status === "pending") return "待领取";
  if (status === "in_progress") return "质检中";
  if (status === "waiting_resubmission") return "等待标注重提";
  if (status === "submitted") return "已提交";
  return status;
}

function getReviewResultText(result: string | null): string {
  if (result === "pass") return "通过";
  if (result === "reject") return "打回";
  return "-";
}

function getLatestSubmittedReview(
  reviewTask: ProjectTaskReviewTaskDetail | null,
): ProjectTaskReviewItem | null {
  if (!reviewTask) {
    return null;
  }

  return (
    reviewTask.review_history.find(
      (item) => item.id !== reviewTask.review.id && item.review_status === "submitted",
    ) || null
  );
}

function getReviewerText(reviewItem: ProjectTaskReviewItem): string {
  if (reviewItem.reviewer_username || reviewItem.reviewer_id) {
    return `${reviewItem.reviewer_username || ""}${reviewItem.reviewer_id ? ` (#${reviewItem.reviewer_id})` : ""}`.trim();
  }
  return "-";
}

function getAnnotatorText(reviewTask: ProjectTaskReviewTaskDetail): string {
  if (reviewTask.task.annotation_assignee_username || reviewTask.task.annotation_assignee_id) {
    return `${reviewTask.task.annotation_assignee_username || ""}${
      reviewTask.task.annotation_assignee_id ? ` (#${reviewTask.task.annotation_assignee_id})` : ""
    }`.trim();
  }
  return "-";
}

function getEvidenceSourceText(sourceType: string): string {
  if (sourceType === "web_link") return "网页链接";
  if (sourceType === "prompt_requirement") return "题目要求";
  if (sourceType === "project_document") return "项目说明文档";
  if (sourceType === "none") return "无";
  return sourceType;
}

function getEvaluationResultText(hit: boolean | undefined): string {
  if (hit === true) return "命中";
  if (hit === false) return "未命中";
  return "未填写";
}

function findSearchCaseEvaluation(
  evaluations: SingleTurnSearchCaseSubmissionDetail["model_a_evaluations"],
  ruleIndex: number,
) {
  return evaluations.find((item) => item.rule_index === ruleIndex) || null;
}

function buildModelResponseReviewAnnotations(
  drafts: Partial<Record<string, string>>,
): ProjectTaskReviewAnnotationItem[] {
  return MODEL_RESPONSE_REVIEW_COMMENT_SECTIONS.map((section) => ({
    section_key: section.key,
    section_label: section.label,
    comment: (drafts[section.key] || "").trim(),
  })).filter((item) => item.comment);
}

function buildSingleTurnSearchCaseAnnotations(
  drafts: Partial<Record<string, string>>,
): ProjectTaskReviewAnnotationItem[] {
  return SINGLE_TURN_SEARCH_CASE_COMMENT_SECTIONS.map((section) => ({
    section_key: section.key,
    section_label: section.label,
    comment: (drafts[section.key] || "").trim(),
  })).filter((item) => item.comment);
}

function FallbackSubmissionContent({
  reviewTask,
}: {
  reviewTask: ProjectTaskReviewTaskDetail;
}) {
  if (!reviewTask.submission) {
    return <Alert type="info" showIcon message="暂未读取到标注详情" />;
  }

  return (
    <Card className="panel-card" title="标注内容">
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {JSON.stringify(reviewTask.submission, null, 2)}
      </pre>
    </Card>
  );
}

function SearchCaseModelCard({
  title,
  model,
}: {
  title: string;
  model: SingleTurnSearchCaseSubmissionDetail["model_a"];
}) {
  return (
    <Card className="search-case-card" title={title}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Text type="secondary">{model.model_name}</Typography.Text>
        <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
          {model.response_text}
        </Typography.Paragraph>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="分享链接">
            {model.share_link ? (
              <a href={model.share_link} target="_blank" rel="noreferrer">
                打开分享链接
              </a>
            ) : (
              "-"
            )}
          </Descriptions.Item>
        </Descriptions>
        {model.screenshot ? (
          <div>
            <Typography.Text type="secondary">截图</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <img
                src={model.screenshot}
                alt={`${model.model_name} screenshot`}
                style={{
                  width: "100%",
                  maxHeight: 280,
                  objectFit: "contain",
                  borderRadius: 12,
                  border: "1px solid #e7ecf3",
                  background: "#f8fbff",
                }}
              />
            </div>
          </div>
        ) : null}
      </Space>
    </Card>
  );
}

function SearchCaseRulesSection({
  detail,
}: {
  detail: SingleTurnSearchCaseSubmissionDetail;
}) {
  return (
    <Card className="search-case-card" title="评分规则区">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {detail.scoring_rules.map((rule, index) => {
          const modelAEvaluation = findSearchCaseEvaluation(detail.model_a_evaluations, index);
          const modelBEvaluation = findSearchCaseEvaluation(detail.model_b_evaluations, index);

          return (
            <Card
              key={`${detail.task_id}-rule-${index}`}
              type="inner"
              title={`规则 ${index + 1}`}
              extra={<Tag color={Number(rule.weight) < 0 ? "orange" : "blue"}>{`权重 ${rule.weight}`}</Tag>}
            >
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
                  <Descriptions.Item label="规则分类">{rule.rule_category || "-"}</Descriptions.Item>
                  <Descriptions.Item label="证据来源">
                    {getEvidenceSourceText(rule.evidence_source_type)}
                  </Descriptions.Item>
                  <Descriptions.Item label="规则内容" span={2}>
                    {rule.rule_text || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="参考链接" span={2}>
                    {rule.reference_url ? (
                      <a href={rule.reference_url} target="_blank" rel="noreferrer">
                        {rule.reference_url}
                      </a>
                    ) : (
                      "-"
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="引用说明" span={2}>
                    {rule.quote_text || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="补充说明" span={2}>
                    {rule.optional_note || "-"}
                  </Descriptions.Item>
                </Descriptions>

                {rule.evidence_screenshot ? (
                  <div>
                    <Typography.Text type="secondary">证据截图</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <img
                        src={rule.evidence_screenshot}
                        alt={`rule-${index + 1}-evidence`}
                        style={{
                          width: "100%",
                          maxHeight: 260,
                          objectFit: "contain",
                          borderRadius: 12,
                          border: "1px solid #e7ecf3",
                          background: "#f8fbff",
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={12}>
                    <Card size="small" title={`${detail.model_a.model_name} 判定`}>
                      <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="是否命中">
                          {getEvaluationResultText(modelAEvaluation?.hit)}
                        </Descriptions.Item>
                        <Descriptions.Item label="备注">{modelAEvaluation?.note || "-"}</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                  <Col xs={24} xl={12}>
                    <Card size="small" title={`${detail.model_b.model_name} 判定`}>
                      <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="是否命中">
                          {getEvaluationResultText(modelBEvaluation?.hit)}
                        </Descriptions.Item>
                        <Descriptions.Item label="备注">{modelBEvaluation?.note || "-"}</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                </Row>
              </Space>
            </Card>
          );
        })}
      </Space>
    </Card>
  );
}

function SearchCaseScoreSummarySection({
  detail,
}: {
  detail: SingleTurnSearchCaseSubmissionDetail;
}) {
  return (
    <Card className="search-case-card" title="自动统计区">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={8}>
          <Card size="small">
            <Typography.Text type="secondary">正分总分</Typography.Text>
            <Typography.Title level={3}>{detail.score_summary.positive_total_score}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={8}>
          <Card size="small">
            <Typography.Text type="secondary">{detail.model_a.model_name}</Typography.Text>
            <Typography.Title level={3}>
              {`${detail.score_summary.model_a_raw_score} / ${detail.score_summary.model_a_percentage}%`}
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={8}>
          <Card size="small">
            <Typography.Text type="secondary">{detail.model_b.model_name}</Typography.Text>
            <Typography.Title level={3}>
              {`${detail.score_summary.model_b_raw_score} / ${detail.score_summary.model_b_percentage}%`}
            </Typography.Title>
          </Card>
        </Col>
      </Row>

      <Space wrap style={{ marginTop: 16 }}>
        <Tag color={detail.score_summary.model_a_below_target ? "red" : "green"}>
          {detail.score_summary.model_a_below_target ? `${detail.model_a.model_name} 低于 50%` : `${detail.model_a.model_name} 达到 50%`}
        </Tag>
        <Tag color={detail.score_summary.score_gap_exceeds_target ? "orange" : "green"}>
          {detail.score_summary.score_gap_exceeds_target ? "双模型分差超过 15%" : "双模型分差在阈值内"}
        </Tag>
        <Tag>{`分差 ${detail.score_summary.score_gap}%`}</Tag>
        <Tag>{`扣分项 ${detail.penalty_rule_count}`}</Tag>
      </Space>

      <div style={{ marginTop: 16 }}>
        <Typography.Title level={5}>软校验提示</Typography.Title>
        {detail.soft_checks.length === 0 ? (
          <Alert type="success" showIcon message="当前没有额外软风险提示" />
        ) : (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            {detail.soft_checks.map((item) => (
              <Alert
                key={`${item.code}-${item.message}`}
                type={item.level === "warning" ? "warning" : "info"}
                showIcon
                message={item.message}
              />
            ))}
          </Space>
        )}
      </div>
    </Card>
  );
}

export function ProjectReviewPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const projectIdNumber = Number(projectId);
  const [form] = Form.useForm<ReviewFormValues>();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [reviewTask, setReviewTask] = useState<ProjectTaskReviewTaskDetail | null>(null);
  const [schema, setSchema] = useState<ModelResponseReviewSchema>(DEFAULT_MRR_SCHEMA);
  const [rubric, setRubric] = useState<ModelResponseReviewRubric>(DEFAULT_MRR_RUBRIC);
  const [commentDrafts, setCommentDrafts] = useState<Partial<Record<string, string>>>({});
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isModelResponseReview = reviewTask?.task.plugin_code === "model_response_review";
  const isSingleTurnSearchCase = reviewTask?.task.plugin_code === "single_turn_search_case";
  const modelResponseSubmission = isModelResponseReview
    ? (reviewTask?.submission as ModelResponseReviewSubmissionRecord | null)
    : null;
  const singleTurnSearchSubmission = isSingleTurnSearchCase
    ? (reviewTask?.submission as SingleTurnSearchCaseSubmissionDetail | null)
    : null;
  const latestSubmittedReview = getLatestSubmittedReview(reviewTask);
  const inheritedCommentCount = Object.values(commentDrafts).filter((value) => Boolean(value?.trim())).length;

  const loadPageData = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      setLoadError("项目参数不正确");
      return;
    }

    setLoading(true);
    try {
      const [projectDetail, currentTask] = await Promise.all([
        fetchMyProjectDetail(projectIdNumber),
        fetchMyProjectCurrentReviewTask(projectIdNumber),
      ]);

      let nextSchema = DEFAULT_MRR_SCHEMA;
      let nextRubric = DEFAULT_MRR_RUBRIC;

      if (currentTask?.task.plugin_code === "model_response_review") {
        [nextSchema, nextRubric] = await Promise.all([
          fetchModelResponseReviewSchema().catch(() => DEFAULT_MRR_SCHEMA),
          fetchModelResponseReviewRubric().catch(() => DEFAULT_MRR_RUBRIC),
        ]);
      }

      const previousSubmittedReview = getLatestSubmittedReview(currentTask);

      setProject(projectDetail);
      setReviewTask(currentTask);
      setSchema(nextSchema);
      setRubric(nextRubric);
      setCommentsOpen(false);
      setLoadError(null);
      setCommentDrafts(
        currentTask?.task.plugin_code === "model_response_review"
          ? buildModelResponseReviewCommentMap(previousSubmittedReview?.review_annotations)
          : currentTask?.task.plugin_code === "single_turn_search_case"
            ? buildSingleTurnSearchCaseCommentMap(previousSubmittedReview?.review_annotations)
            : {},
      );
      form.setFieldsValue({
        review_result: undefined,
        review_comment: "",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "加载质检任务失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData({ silent: true });
  }, [projectIdNumber]);

  const handleSubmit = async (values: ReviewFormValues) => {
    if (!reviewTask) {
      message.error("当前没有可提交的质检任务");
      return;
    }

    const payload: ProjectTaskReviewSubmitPayload = {
      review_result: values.review_result,
      review_comment: values.review_comment,
      review_annotations: isModelResponseReview
        ? buildModelResponseReviewAnnotations(commentDrafts)
        : isSingleTurnSearchCase
          ? buildSingleTurnSearchCaseAnnotations(commentDrafts)
          : [],
    };

    setSubmitting(true);
    try {
      await submitMyProjectReviewTask(projectIdNumber, reviewTask.review.id, payload);
      message.success(values.review_result === "reject" ? "已打回标注任务" : "质检结果已提交");
      navigate("/user/review-tasks", { replace: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "提交质检结果失败";
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const renderHistoryTable = () => (
    <Card className="panel-card" title="历史质检记录">
      <Table
        rowKey="id"
        pagination={false}
        dataSource={reviewTask?.review_history || []}
        locale={{ emptyText: "暂无质检记录" }}
        columns={[
          { title: "轮次", dataIndex: "review_round", width: 80 },
          {
            title: "质检员",
            width: 180,
            render: (_, record: ProjectTaskReviewItem) => getReviewerText(record),
          },
          {
            title: "状态",
            dataIndex: "review_status",
            width: 140,
            render: (value: string) => getReviewStatusText(value),
          },
          {
            title: "结果",
            dataIndex: "review_result",
            width: 120,
            render: (value: string | null) => getReviewResultText(value),
          },
          {
            title: "说明",
            dataIndex: "review_comment",
            render: (value: string | null) => value || "-",
          },
        ]}
      />
    </Card>
  );

  const renderPreviousReviewAlert = () => {
    if (!latestSubmittedReview) {
      return null;
    }

    return (
      <Alert
        type="info"
        showIcon
        message={`第 ${latestSubmittedReview.review_round} 轮质检历史信息`}
        description={
          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            {latestSubmittedReview.review_comment ? (
              <div>
                <Typography.Text strong>上一轮整体说明：</Typography.Text>
                <Typography.Paragraph style={{ margin: "4px 0 0" }}>
                  {latestSubmittedReview.review_comment}
                </Typography.Paragraph>
                <Typography.Text type="secondary">
                  上面这段只作为历史参考，不会自动填入本轮“整体说明”。
                </Typography.Text>
              </div>
            ) : null}
            {inheritedCommentCount > 0 ? (
              <Typography.Text>
                {`右侧批注抽屉已带入上一轮 ${inheritedCommentCount} 条模块批注，可直接在原意见基础上继续修改。`}
              </Typography.Text>
            ) : null}
          </Space>
        }
      />
    );
  };

  const renderTaskOverview = (cardClassName = "panel-card") => {
    if (!reviewTask) {
      return null;
    }

    return (
      <Card className={cardClassName} title="任务概览">
        <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
          <Descriptions.Item label="质检轮次">{reviewTask.review.review_round}</Descriptions.Item>
          <Descriptions.Item label="任务状态">
            <Tag color="blue">{getTaskStatusText(reviewTask.task.task_status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="任务标识">{reviewTask.task.external_task_id}</Descriptions.Item>
          <Descriptions.Item label="标注员">{getAnnotatorText(reviewTask)}</Descriptions.Item>
          <Descriptions.Item label="标注提交时间">
            {reviewTask.task.annotation_submitted_at
              ? new Date(reviewTask.task.annotation_submitted_at).toLocaleString()
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="累计质检次数">{reviewTask.task.review_round_count}</Descriptions.Item>
        </Descriptions>
      </Card>
    );
  };

  const renderReviewForm = (cardClassName = "panel-card", overallLabel = "整体说明") => (
    <Card className={cardClassName} title="提交质检结果">
      <Form<ReviewFormValues> layout="vertical" form={form} onFinish={handleSubmit}>
        <Form.Item
          label="质检结论"
          name="review_result"
          rules={[{ required: true, message: "请选择质检结论" }]}
        >
          <Radio.Group
            options={[
              { label: "通过", value: "pass" },
              { label: "打回", value: "reject" },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={overallLabel}
          name="review_comment"
          rules={[{ required: true, message: "请输入整体说明" }]}
        >
          <Input.TextArea
            rows={6}
            maxLength={2000}
            showCount
            placeholder="如果已经带入上一轮意见，可以直接在原内容基础上继续修改后提交。"
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting}>
          提交质检
        </Button>
      </Form>
    </Card>
  );

  const renderModelResponseReviewWorkspace = () => {
    if (!reviewTask || !modelResponseSubmission) {
      return null;
    }

    return (
      <>
        <Card className="review-card">
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Space wrap>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/user/review-tasks")}>
                返回质检任务
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => void loadPageData()} loading={loading}>
                刷新
              </Button>
            </Space>
            <div>
              <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                {project?.name || "质检任务"}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                左侧查看最新标注内容，右侧抽屉按模块填写批注。重新进入同一任务时，会自动带入上一轮质检意见和模块批注。
              </Typography.Paragraph>
            </div>
          </Space>
        </Card>

        {renderPreviousReviewAlert()}

        <ModelResponseReviewCommentDrawer
          title="批注板块"
          open={commentsOpen}
          editable
          commentMap={commentDrafts as Partial<Record<ModelResponseReviewCommentSectionKey, string>>}
          description="按模块填写质检批注，提交打回时会连同批注一起回给标注员。"
          onToggle={() => setCommentsOpen((value) => !value)}
          onCommentChange={(key, value) => setCommentDrafts((drafts) => ({ ...drafts, [key]: value }))}
        />

        {renderTaskOverview("review-card")}

        <ModelResponseReviewSectionCard title="任务类型">
          <Select
            disabled
            value={modelResponseSubmission.task_category}
            options={(schema.task_category_options ?? []).map((item) => ({ label: item, value: item }))}
          />
        </ModelResponseReviewSectionCard>

        <ModelResponseReviewSectionCard title="Prompt">
          <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
            {modelResponseSubmission.prompt_snapshot}
          </Typography.Paragraph>
        </ModelResponseReviewSectionCard>

        <ModelResponseReviewSectionCard title="模型回答">
          <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
            {modelResponseSubmission.model_reply_snapshot}
          </Typography.Paragraph>
        </ModelResponseReviewSectionCard>

        <Card title="评审标准" className="review-card">
          <Typography.Paragraph style={{ marginBottom: 16 }}>{rubric.intro}</Typography.Paragraph>
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {(rubric.levels ?? []).map((level) => (
              <div key={level.rating} className="review-rubric-level">
                <Typography.Text strong>{level.rating}</Typography.Text>
                <Typography.Paragraph style={{ marginBottom: 0 }}>{level.guidance}</Typography.Paragraph>
              </div>
            ))}
          </Space>
        </Card>

        <ModelResponseReviewSectionCard title="回答评级">
          <Radio.Group className="review-rating-group" disabled value={modelResponseSubmission.answer_rating}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {(schema.answer_rating_options ?? []).map((item) => (
                <Radio key={item} value={item}>
                  {item}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </ModelResponseReviewSectionCard>

        <ModelResponseReviewSectionCard title="评级理由">
          <Input.TextArea rows={7} disabled value={modelResponseSubmission.rating_reason} />
        </ModelResponseReviewSectionCard>

        {renderReviewForm("review-card")}

        {renderHistoryTable()}
      </>
    );
  };

  const renderSingleTurnSearchCaseWorkspace = () => {
    if (!reviewTask || !singleTurnSearchSubmission) {
      return null;
    }

    return (
      <>
        <Card className="search-case-card">
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Space wrap>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/user/review-tasks")}>
                返回质检任务
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => void loadPageData()} loading={loading}>
                刷新
              </Button>
            </Space>
            <div>
              <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                {project?.name || "质检任务"}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                质检页已切成和标注页一致的工作台结构，左侧直接复用标注内容模块，右侧抽屉按模块填写批注；重新进入时会保留上一轮意见。
              </Typography.Paragraph>
            </div>
          </Space>
        </Card>

        {renderPreviousReviewAlert()}

        <SingleTurnSearchCaseCommentDrawer
          title="批注板块"
          open={commentsOpen}
          editable
          commentMap={commentDrafts as Partial<Record<SingleTurnSearchCaseCommentSectionKey, string>>}
          description="按模块填写质检批注，打回后批注会随任务一起回到标注员。"
          onToggle={() => setCommentsOpen((value) => !value)}
          onCommentChange={(key, value) => setCommentDrafts((drafts) => ({ ...drafts, [key]: value }))}
        />

        {renderTaskOverview("search-case-card")}

        <Card className="search-case-card" title="出题信息区">
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
              <Descriptions.Item label="题目领域">{singleTurnSearchSubmission.domain}</Descriptions.Item>
              <Descriptions.Item label="时效标签">{singleTurnSearchSubmission.timeliness_tag}</Descriptions.Item>
            </Descriptions>
            <div>
              <Typography.Text type="secondary">场景说明</Typography.Text>
              <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0, marginTop: 8 }}>
                {singleTurnSearchSubmission.scenario_description}
              </Typography.Paragraph>
            </div>
            <div>
              <Typography.Text type="secondary">Prompt</Typography.Text>
              <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0, marginTop: 8 }}>
                {singleTurnSearchSubmission.prompt}
              </Typography.Paragraph>
            </div>
          </Space>
        </Card>

        <Row gutter={[18, 18]}>
          <Col xs={24} xl={12}>
            <SearchCaseModelCard title="模型一回复录入区" model={singleTurnSearchSubmission.model_a} />
          </Col>
          <Col xs={24} xl={12}>
            <SearchCaseModelCard title="模型二回复录入区" model={singleTurnSearchSubmission.model_b} />
          </Col>
        </Row>

        <Card className="search-case-card" title="参考答案区">
          <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
            {singleTurnSearchSubmission.reference_answer}
          </Typography.Paragraph>
        </Card>

        <SearchCaseRulesSection detail={singleTurnSearchSubmission} />

        <SearchCaseScoreSummarySection detail={singleTurnSearchSubmission} />

        {renderReviewForm("search-case-card", "整体说明")}

        {renderHistoryTable()}
      </>
    );
  };

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        {loadError ? <Alert type="warning" showIcon message="加载质检任务失败" description={loadError} /> : null}

        {!reviewTask ? (
          <Card className="panel-card">
            <Empty description="当前项目没有已领取的质检任务" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={() => navigate("/user/task-hall")}>
                去任务大厅领取
              </Button>
            </Empty>
          </Card>
        ) : isModelResponseReview ? (
          renderModelResponseReviewWorkspace()
        ) : isSingleTurnSearchCase ? (
          renderSingleTurnSearchCaseWorkspace()
        ) : (
          <>
            <Card
              className="panel-card"
              extra={
                <Space>
                  <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/user/review-tasks")}>
                    返回质检任务
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={() => void loadPageData()} loading={loading}>
                    刷新
                  </Button>
                </Space>
              }
            >
              <Typography.Title level={4} style={{ marginTop: 0 }}>
                {project?.name || "质检任务"}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                当前会展示最新标注内容，并自动带入上一轮整体质检意见。
              </Typography.Paragraph>
            </Card>

            {renderPreviousReviewAlert()}

            {renderTaskOverview()}

            <FallbackSubmissionContent reviewTask={reviewTask} />

            {renderReviewForm()}

            {renderHistoryTable()}
          </>
        )}
      </Space>
    </Spin>
  );
}
