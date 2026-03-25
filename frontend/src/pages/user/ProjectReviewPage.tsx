import { ArrowLeftOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Radio,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { claimMyProjectReviewTask, fetchMyProjectDetail, submitMyProjectReviewTask } from "../../services/api";
import type { ProjectItem, ProjectTaskReviewSubmitPayload, ProjectTaskReviewTaskDetail } from "../../types/api";

interface ReviewFormValues {
  review_result: "pass" | "reject";
  review_comment: string;
}

function getTaskStatusText(status: string): string {
  if (status === "review_pending") return "待领取";
  if (status === "review_in_progress") return "质检中";
  if (status === "review_submitted") return "待管理员处理";
  if (status === "pending_review_dispatch") return "待发起质检";
  if (status === "approved") return "已通过";
  return status;
}

export function ProjectReviewPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const projectIdNumber = Number(projectId);
  const [form] = Form.useForm<ReviewFormValues>();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [reviewTask, setReviewTask] = useState<ProjectTaskReviewTaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const submissionPreview = useMemo(
    () => (reviewTask?.submission ? JSON.stringify(reviewTask.submission, null, 2) : ""),
    [reviewTask],
  );

  const loadPageData = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      setLoadError("项目参数不正确");
      return;
    }

    setLoading(true);
    try {
      const [projectDetail, claimedTask] = await Promise.all([
        fetchMyProjectDetail(projectIdNumber),
        claimMyProjectReviewTask(projectIdNumber),
      ]);
      setProject(projectDetail);
      setReviewTask(claimedTask);
      setLoadError(null);
      form.resetFields();
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
    };

    setSubmitting(true);
    try {
      await submitMyProjectReviewTask(projectIdNumber, reviewTask.review.id, payload);
      message.success("质检结果已提交");
      navigate("/user/review-tasks", { replace: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "提交质检结果失败";
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <Card
          className="panel-card"
          extra={
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/user/review-tasks")}>
                返回质检任务
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => void loadPageData()}>
                刷新
              </Button>
            </Space>
          }
        >
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            {project?.name || "质检任务"}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            系统会自动分配一条当前未被其他质检人员占用的任务。提交后由管理员决定是否继续追加质检轮次或直接通过。
          </Typography.Paragraph>
        </Card>

        {loadError ? <Alert type="warning" showIcon message="加载质检任务失败" description={loadError} /> : null}

        {!reviewTask ? (
          <Card className="panel-card">
            <Empty description="当前项目没有待领取的质检任务" />
          </Card>
        ) : (
          <>
            <Card className="panel-card" title="任务概览">
              <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
                <Descriptions.Item label="质检轮次">{reviewTask.review.review_round}</Descriptions.Item>
                <Descriptions.Item label="任务状态">
                  <Tag color="blue">{getTaskStatusText(reviewTask.task.task_status)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="任务标识">{reviewTask.task.external_task_id}</Descriptions.Item>
                <Descriptions.Item label="试标人">
                  {reviewTask.task.annotation_assignee_username || reviewTask.task.annotation_assignee_id
                    ? `${reviewTask.task.annotation_assignee_username || ""}${reviewTask.task.annotation_assignee_id ? ` (#${reviewTask.task.annotation_assignee_id})` : ""}`.trim()
                    : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="试标提交时间">
                  {reviewTask.task.annotation_submitted_at ? new Date(reviewTask.task.annotation_submitted_at).toLocaleString() : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="累计质检次数">{reviewTask.task.review_round_count}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card className="panel-card" title="试标内容">
              {submissionPreview ? (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{submissionPreview}</pre>
              ) : (
                <Alert type="info" showIcon message="暂未读取到试标详情" />
              )}
            </Card>

            <Card className="panel-card" title="历史质检记录">
              <Table
                rowKey="id"
                pagination={false}
                dataSource={reviewTask.review_history}
                locale={{ emptyText: "暂无质检记录" }}
                columns={[
                  { title: "轮次", dataIndex: "review_round", width: 80 },
                  {
                    title: "质检人",
                    width: 160,
                    render: (_, record) =>
                      record.reviewer_username || record.reviewer_id
                        ? `${record.reviewer_username || ""}${record.reviewer_id ? ` (#${record.reviewer_id})` : ""}`.trim()
                        : "-",
                  },
                  { title: "状态", dataIndex: "review_status", width: 140 },
                  { title: "结果", dataIndex: "review_result", width: 120, render: (value: string | null) => value || "-" },
                  {
                    title: "备注",
                    dataIndex: "review_comment",
                    render: (value: string | null) => value || "-",
                  },
                ]}
              />
            </Card>

            <Card className="panel-card" title="提交质检结果">
              <Form<ReviewFormValues> layout="vertical" form={form} onFinish={handleSubmit}>
                <Form.Item
                  label="质检结论"
                  name="review_result"
                  rules={[{ required: true, message: "请选择质检结论" }]}
                >
                  <Radio.Group
                    options={[
                      { label: "通过", value: "pass" },
                      { label: "不通过", value: "reject" },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label="质检备注"
                  name="review_comment"
                  rules={[{ required: true, message: "请输入质检备注" }]}
                >
                  <Input.TextArea rows={6} maxLength={2000} showCount placeholder="请说明质检判断依据和问题点" />
                </Form.Item>
                <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting}>
                  提交质检
                </Button>
              </Form>
            </Card>
          </>
        )}
      </Space>
    </Spin>
  );
}
