import { InfoCircleOutlined, ReloadOutlined, SendOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import {
  fetchModelResponseReviewCurrentTask,
  fetchModelResponseReviewProjectStats,
  fetchModelResponseReviewRubric,
  fetchModelResponseReviewSchema,
  fetchModelResponseReviewSubmissionRecords,
  generateModelResponseReviewTaskResponse,
  submitModelResponseReviewSubmission,
  validateModelResponseReviewSubmission,
} from "../../services/api";
import type {
  ModelResponseReviewProjectStats,
  ModelResponseReviewRubric,
  ModelResponseReviewSchema,
  ModelResponseReviewSubmissionPayload,
  ModelResponseReviewSubmissionRecord,
  ModelResponseReviewTaskItem,
} from "../../types/api";

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
    return "请填写评审理由";
  }
  if (field === "task_id") {
    return "当前任务不存在、未发布或已完成，请刷新后重试";
  }
  if (field === "project_id") {
    return "当前项目不可用，请返回项目列表后重试";
  }
  if (field === "model_reply_snapshot") {
    return "请先生成模型回答";
  }
  return "请检查提交内容";
}

function isReviewFieldName(field: string): field is ReviewFieldName {
  return field === "task_category" || field === "answer_rating" || field === "rating_reason";
}

function getTaskStatusText(status: string | undefined): string {
  if (status === "pending") {
    return "待处理";
  }
  if (status === "completed") {
    return "已完成";
  }
  return status || "-";
}

const DEFAULT_MRR_SCHEMA: ModelResponseReviewSchema = {
  plugin_code: "model_response_review",
  plugin_version: "1.0.0",
  page_title: "Model Response Review",
  sections: [
    "Task Overview",
    "Task Category",
    "Prompt",
    "Model Response",
    "Review Rubric",
    "Answer Rating",
    "Rating Rationale",
  ],
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
  const { projectId } = useParams<{ projectId: string }>();
  const projectIdNumber = useMemo(() => Number(projectId), [projectId]);
  const [form] = Form.useForm<ReviewFormValues>();
  const [schema, setSchema] = useState<ModelResponseReviewSchema | null>(null);
  const [rubric, setRubric] = useState<ModelResponseReviewRubric | null>(null);
  const [stats, setStats] = useState<ModelResponseReviewProjectStats | null>(null);
  const [currentTask, setCurrentTask] = useState<ModelResponseReviewTaskItem | null>(null);
  const [submissions, setSubmissions] = useState<ModelResponseReviewSubmissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const resetPageState = () => {
    setSchema(DEFAULT_MRR_SCHEMA);
    setRubric(DEFAULT_MRR_RUBRIC);
    setStats(null);
    setCurrentTask(null);
    setSubmissions([]);
    setLoadError(null);
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
      const [statsData, taskData, recordData] = await Promise.all([
        fetchModelResponseReviewProjectStats(projectIdNumber),
        fetchModelResponseReviewCurrentTask(projectIdNumber),
        fetchModelResponseReviewSubmissionRecords(projectIdNumber, 10),
      ]);
      if (requestId !== requestIdRef.current) {
        return;
      }

      setStats(statsData);
      setCurrentTask(taskData);
      setSubmissions(Array.isArray(recordData) ? recordData : []);

      form.setFieldsValue({
        task_category: taskData?.task_category,
        answer_rating: undefined,
        rating_reason: "",
      });
      form.setFields([
        { name: "task_category", errors: [] },
        { name: "answer_rating", errors: [] },
        { name: "rating_reason", errors: [] },
      ]);

      try {
        const [schemaData, rubricData] = await Promise.all([fetchModelResponseReviewSchema(), fetchModelResponseReviewRubric()]);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSchema(schemaData);
        setRubric(rubricData);
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSchema(DEFAULT_MRR_SCHEMA);
        setRubric(DEFAULT_MRR_RUBRIC);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "加载评审任务失败，请稍后重试";
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

  const handleSubmit = async (values: ReviewFormValues) => {
    if (!currentTask || !rubric || Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
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
      annotator_id: null,
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

      const result = await submitModelResponseReviewSubmission(projectIdNumber, payload);
      message.success(`评审结果已提交，记录编号 ${result.submission_id}`);
      await loadPageData({ silent: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "提交评审结果失败";
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div className="review-page">
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          {loadError ? <Alert type="warning" showIcon message="加载评审任务失败" description={loadError} /> : null}

          <Card
            className="review-card review-card--overview"
            title="Task Overview"
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => void loadPageData()} loading={loading}>
                刷新任务
              </Button>
            }
          >
            <Descriptions column={{ xs: 1, md: 2 }} size="small">
              <Descriptions.Item label="Project ID">{projectIdNumber || "-"}</Descriptions.Item>
              <Descriptions.Item label="Plugin">{schema?.plugin_code ?? "model_response_review"}</Descriptions.Item>
              <Descriptions.Item label="Task ID">{currentTask?.task_id ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Rubric Version">
                {currentTask?.rubric_version ?? rubric?.version ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Progress">
                {stats ? `${stats.completed_tasks}/${stats.total_tasks}` : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Pending">{stats?.pending_tasks ?? "-"}</Descriptions.Item>
            </Descriptions>
            <Space wrap style={{ marginTop: 16 }}>
              {currentTask ? <Tag color="blue">{getTaskStatusText(currentTask.status)}</Tag> : <Tag>当前暂无待处理任务</Tag>}
              {(currentTask ? Object.entries(currentTask.metadata ?? {}) : []).map(([key, value]) => (
                <Tag key={key}>{`${key}: ${String(value)}`}</Tag>
              ))}
            </Space>
          </Card>

          {!currentTask ? (
            <Card className="review-card">
              <Empty
                description="当前项目暂无可领取任务"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          ) : (
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Space direction="vertical" size={18} style={{ width: "100%" }}>
                <Card title="Task Category" className="review-card">
                  <Form.Item
                    name="task_category"
                    rules={[{ required: true, message: "请选择任务类型" }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      options={(schema?.task_category_options ?? []).map((item) => ({
                        label: item,
                        value: item,
                      }))}
                      placeholder="请选择任务类型"
                    />
                  </Form.Item>
                </Card>

                <Card title="Prompt" className="review-card">
                  <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                    {currentTask.prompt}
                  </Typography.Paragraph>
                </Card>

                <Card
                  title="Model Response"
                  className="review-card"
                  extra={
                    (
                      <Button
                        type={currentTask.model_reply ? "default" : "primary"}
                        ghost={!currentTask.model_reply}
                        icon={<ThunderboltOutlined />}
                        loading={generating}
                        onClick={() => void handleGenerateResponse(Boolean(currentTask.model_reply))}
                      >
                        生成模型回答
                      </Button>
                    )
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
                      description="点击右上角按钮后，平台会由后端根据 Prompt 生成模型回答，并回写到当前任务中。"
                    />
                  )}
                </Card>

                <Card title="Review Rubric" className="review-card">
                  <Typography.Paragraph style={{ marginBottom: 16 }}>{rubric?.intro ?? "-"}</Typography.Paragraph>
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {(rubric?.levels ?? []).map((level) => (
                      <div key={level.rating} className="review-rubric-level">
                        <Typography.Text strong>{level.rating}</Typography.Text>
                        <Typography.Paragraph style={{ marginBottom: 0 }}>
                          {level.guidance}
                        </Typography.Paragraph>
                      </div>
                    ))}
                  </Space>
                  <Typography.Title level={5} style={{ marginTop: 20 }}>
                    Review Notes
                  </Typography.Title>
                  <ul className="review-rubric-notes">
                    {(rubric?.review_notes ?? []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Card>

                <Card title="Answer Rating" className="review-card">
                  <Form.Item
                    name="answer_rating"
                    rules={[{ required: true, message: "请选择回答评级" }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Radio.Group className="review-rating-group">
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        {(schema?.answer_rating_options ?? []).map((item) => (
                          <Radio key={item} value={item}>
                            {item}
                          </Radio>
                        ))}
                      </Space>
                    </Radio.Group>
                  </Form.Item>
                </Card>

                <Card title="Rating Rationale" className="review-card">
                  <Form.Item
                    name="rating_reason"
                    rules={[{ required: true, message: "请填写评审理由" }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea
                      rows={7}
                      placeholder={schema?.rating_reason_placeholder ?? "请说明你给出该评级的主要原因"}
                      maxLength={2000}
                      showCount
                    />
                  </Form.Item>
                </Card>

                <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting} size="large">
                  提交评审
                </Button>
              </Space>
            </Form>
          )}

          <Card title="最近提交记录" className="review-card">
            <Table<ModelResponseReviewSubmissionRecord>
              rowKey="submission_id"
              dataSource={Array.isArray(submissions) ? submissions : []}
              pagination={false}
              locale={{ emptyText: <Empty description="暂无提交记录" /> }}
              columns={[
                {
                  title: "提交时间",
                  dataIndex: "submitted_at",
                  width: 180,
                  render: (value: string) => new Date(value).toLocaleString(),
                },
                {
                  title: "任务 ID",
                  dataIndex: "task_id",
                  width: 180,
                },
                {
                  title: "任务类型",
                  dataIndex: "task_category",
                  width: 160,
                },
                {
                  title: "评级",
                  dataIndex: "answer_rating",
                  width: 160,
                },
                {
                  title: "评审理由",
                  dataIndex: "rating_reason",
                  render: (value: string) => (
                    <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, expandable: true }}>
                      {value}
                    </Typography.Paragraph>
                  ),
                },
              ]}
            />
          </Card>
        </Space>
      </div>
    </Spin>
  );
}
