import { ArrowLeftOutlined, ReloadOutlined, SendOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Popconfirm,
  Radio,
  Select,
  Space,
  Spin,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  fetchModelResponseReviewCurrentTask,
  fetchModelResponseReviewMySubmissionDetail,
  fetchModelResponseReviewRubric,
  fetchModelResponseReviewSchema,
  fetchModelResponseReviewTask,
  generateModelResponseReviewTaskResponse,
  releaseMyProjectAnnotationTaskByTaskId,
  submitModelResponseReviewSubmission,
  validateModelResponseReviewSubmission,
} from "../../services/api";
import type {
  ModelResponseReviewRubric,
  ModelResponseReviewSchema,
  ModelResponseReviewSubmissionPayload,
  ModelResponseReviewSubmissionRecord,
  ModelResponseReviewTaskItem,
} from "../../types/api";
import { readSession } from "../../utils/session";
import {
  buildModelResponseReviewCommentMap,
  ModelResponseReviewCommentDrawer,
  ModelResponseReviewSectionCard,
} from "./modelResponseReviewWorkspace";

interface ReviewFormValues {
  task_category: string;
  answer_rating: string;
  rating_reason: string;
}

type ReviewFieldName = keyof ReviewFormValues;

function mapValidationMessage(field: string): string {
  if (field === "task_category") {
    return "请选择任务类型";
  }
  if (field === "answer_rating") {
    return "请选择回答评级";
  }
  if (field === "rating_reason") {
    return "请填写评级理由";
  }
  if (field === "task_id") {
    return "当前任务不存在、未发布或已完成，请刷新后重试";
  }
  if (field === "project_id") {
    return "当前项目不可用，请返回标注任务页后重试";
  }
  if (field === "model_reply_snapshot") {
    return "请先生成模型回答";
  }
  return "请检查提交内容";
}

function isReviewFieldName(field: string): field is ReviewFieldName {
  return field === "task_category" || field === "answer_rating" || field === "rating_reason";
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

export function ModelResponseReviewPage() {
  const navigate = useNavigate();
  const { projectId, taskId } = useParams<{ projectId: string; taskId?: string }>();
  const projectIdNumber = useMemo(() => Number(projectId), [projectId]);
  const taskIdValue = useMemo(() => taskId || "", [taskId]);
  const [form] = Form.useForm<ReviewFormValues>();
  const [schema, setSchema] = useState<ModelResponseReviewSchema>(DEFAULT_MRR_SCHEMA);
  const [rubric, setRubric] = useState<ModelResponseReviewRubric>(DEFAULT_MRR_RUBRIC);
  const [currentTask, setCurrentTask] = useState<ModelResponseReviewTaskItem | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<ModelResponseReviewSubmissionRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const latestReview = latestSubmission?.latest_review ?? null;
  const reviewCommentMap = buildModelResponseReviewCommentMap(latestReview?.review_annotations);
  const hasModuleComments = Object.values(reviewCommentMap).some((value) => Boolean(value?.trim()));

  const loadPageData = async ({ silent = false }: { silent?: boolean } = {}) => {
    const requestId = ++requestIdRef.current;
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      setLoadError("项目参数不正确");
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [taskData, schemaData, rubricData] = await Promise.all([
        taskIdValue
          ? fetchModelResponseReviewTask(projectIdNumber, taskIdValue)
          : fetchModelResponseReviewCurrentTask(projectIdNumber),
        fetchModelResponseReviewSchema().catch(() => DEFAULT_MRR_SCHEMA),
        fetchModelResponseReviewRubric().catch(() => DEFAULT_MRR_RUBRIC),
      ]);
      if (requestId !== requestIdRef.current) {
        return;
      }

      const submissionDetail = taskData
        ? await fetchModelResponseReviewMySubmissionDetail(projectIdNumber, taskData.task_id).catch(() => null)
        : null;
      if (requestId !== requestIdRef.current) {
        return;
      }

      setCurrentTask(taskData);
      setLatestSubmission(submissionDetail);
      setSchema(schemaData);
      setRubric(rubricData);
      setCommentsOpen(false);

      if (taskData) {
        form.setFieldsValue({
          task_category: submissionDetail?.task_category || taskData.task_category,
          answer_rating: submissionDetail?.answer_rating,
          rating_reason: submissionDetail?.rating_reason || "",
        });
        form.setFields([
          { name: "task_category", errors: [] },
          { name: "answer_rating", errors: [] },
          { name: "rating_reason", errors: [] },
        ]);
      } else {
        form.resetFields();
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "加载标注任务失败，请稍后重试";
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
    void loadPageData({ silent: true });
    return () => {
      requestIdRef.current += 1;
    };
  }, [projectIdNumber, taskIdValue]);

  const handleGenerateResponse = async (force = false) => {
    if (!currentTask || Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      message.error("当前没有可生成回答的任务");
      return;
    }

    setGenerating(true);
    try {
      const updatedTask = await generateModelResponseReviewTaskResponse(projectIdNumber, currentTask.task_id, force);
      setCurrentTask(updatedTask);
      message.success("模型回答已生成");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "生成模型回答失败";
      message.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleRelease = async () => {
    if (!currentTask || Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      message.error("项目参数不正确");
      return;
    }

    setReleasing(true);
    try {
      const task = currentTask;
      await releaseMyProjectAnnotationTaskByTaskId(projectIdNumber, task.task_id);
      message.success("已放弃当前任务，题目已回到任务池");
      navigate("/user/annotation-tasks", { replace: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "放弃当前任务失败";
      message.error(errorMessage);
    } finally {
      setReleasing(false);
    }
  };

  const handleSubmit = async (values: ReviewFormValues) => {
    if (!currentTask || Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      message.error("当前没有可提交的任务");
      return;
    }

    if (!currentTask.model_reply) {
      message.error("请先生成模型回答");
      return;
    }

    const payload: ModelResponseReviewSubmissionPayload = {
      project_id: projectIdNumber,
      task_id: currentTask.task_id,
      annotator_id: readSession()?.user.id ?? null,
      task_category: values.task_category,
      answer_rating: values.answer_rating,
      rating_reason: values.rating_reason,
      prompt_snapshot: currentTask.prompt,
      model_reply_snapshot: currentTask.model_reply,
      rubric_version: currentTask.rubric_version,
      rubric_snapshot: rubric as unknown as Record<string, unknown>,
      metadata: currentTask.metadata ?? {},
    };

    setSubmitting(true);
    try {
      const validation = await validateModelResponseReviewSubmission(projectIdNumber, payload);
      if (!validation.valid) {
        form.setFields(
          validation.errors
            .filter((issue) => isReviewFieldName(issue.field))
            .map((issue) => ({
              name: issue.field as ReviewFieldName,
              errors: [mapValidationMessage(issue.field)],
            })),
        );
        const firstIssue = validation.errors[0];
        message.error(firstIssue ? mapValidationMessage(firstIssue.field) : "提交内容未通过校验");
        return;
      }

      await submitModelResponseReviewSubmission(projectIdNumber, payload);
      message.success("标注已提交，任务已进入质检队列");
      navigate("/user/annotation-tasks", { replace: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "提交标注失败";
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div className="review-page" style={{ padding: 24 }}>
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <Card className="review-card">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Space wrap className="mrr-workspace__toolbar">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/user/annotation-tasks")}>
                  退出当前界面
                </Button>
                <Popconfirm
                  title="确定放弃当前任务吗？"
                  description="放弃后，当前题目会回到任务池，其他人也可以继续领取。"
                  okText="确定放弃"
                  cancelText="取消"
                  onConfirm={() => void handleRelease()}
                >
                  <Button danger loading={releasing} disabled={!currentTask}>
                    放弃当前任务
                  </Button>
                </Popconfirm>
                <Button icon={<ReloadOutlined />} onClick={() => void loadPageData()} loading={loading}>
                  刷新
                </Button>
              </Space>
              <div>
                <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                  模型回答评审任务
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  首次标注不需要写批注。若任务被质检打回，可通过右侧箭头拉出批注板块查看本轮修改意见。
                </Typography.Paragraph>
              </div>
            </Space>
          </Card>

          {hasModuleComments ? (
            <ModelResponseReviewCommentDrawer
              title="质检批注"
              open={commentsOpen}
              commentMap={reviewCommentMap}
              description="按模块查看本轮质检意见。"
              onToggle={() => setCommentsOpen((value) => !value)}
            />
          ) : null}

          {latestReview?.review_result === "reject" ? (
            <Alert
              type="warning"
              showIcon
              message={`第 ${latestReview.review_round} 轮质检已打回`}
              description={latestReview.review_comment || "请根据右侧批注修改后重新提交。"}
            />
          ) : null}

          {loadError ? <Alert type="warning" showIcon message="加载标注任务失败" description={loadError} /> : null}

          {!currentTask ? (
            <Card className="review-card">
              <Empty description="当前项目没有可继续处理的标注任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          ) : (
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Space direction="vertical" size={18} style={{ width: "100%" }}>
                <ModelResponseReviewSectionCard title="任务类型">
                  <Form.Item
                    name="task_category"
                    rules={[{ required: true, message: "请选择任务类型" }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      options={(schema.task_category_options ?? []).map((item) => ({
                        label: item,
                        value: item,
                      }))}
                      placeholder="请选择任务类型"
                    />
                  </Form.Item>
                </ModelResponseReviewSectionCard>

                <ModelResponseReviewSectionCard title="Prompt">
                  <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                    {currentTask.prompt}
                  </Typography.Paragraph>
                </ModelResponseReviewSectionCard>

                <ModelResponseReviewSectionCard
                  title="模型回答"
                  extra={
                    <Button
                      type={currentTask.model_reply ? "default" : "primary"}
                      ghost={!currentTask.model_reply}
                      icon={<ThunderboltOutlined />}
                      loading={generating}
                      onClick={() => void handleGenerateResponse(Boolean(currentTask.model_reply))}
                    >
                      {currentTask.model_reply ? "重新生成模型回答" : "生成模型回答"}
                    </Button>
                  }
                >
                  {currentTask.model_reply ? (
                    <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                      {currentTask.model_reply}
                    </Typography.Paragraph>
                  ) : (
                    <Alert
                      type="info"
                      showIcon
                      message="当前任务还没有模型回答"
                      description="点击右上角按钮后，平台会根据当前 Prompt 生成模型回答，再继续完成标注。"
                    />
                  )}
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
                  <Form.Item
                    name="answer_rating"
                    rules={[{ required: true, message: "请选择回答评级" }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Radio.Group className="review-rating-group">
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        {(schema.answer_rating_options ?? []).map((item) => (
                          <Radio key={item} value={item}>
                            {item}
                          </Radio>
                        ))}
                      </Space>
                    </Radio.Group>
                  </Form.Item>
                </ModelResponseReviewSectionCard>

                <ModelResponseReviewSectionCard title="评级理由">
                  <Form.Item
                    name="rating_reason"
                    rules={[{ required: true, message: "请填写评级理由" }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea
                      rows={7}
                      placeholder={schema.rating_reason_placeholder || "请说明你给出该评级的主要原因"}
                      maxLength={2000}
                      showCount
                    />
                  </Form.Item>
                </ModelResponseReviewSectionCard>

                <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting} size="large">
                  提交标注
                </Button>
              </Space>
            </Form>
          )}
        </Space>
      </div>
    </Spin>
  );
}
