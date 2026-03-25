import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Space, Spin, Typography, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  fetchModelResponseReviewMySubmissionDetail,
  fetchModelResponseReviewMySubmissionDetailById,
} from "../../services/api";
import type { ModelResponseReviewSubmissionRecord } from "../../types/api";

export function ModelResponseReviewSubmissionDetailPage() {
  const navigate = useNavigate();
  const { projectId, taskId, submissionId } = useParams<{
    projectId: string;
    taskId?: string;
    submissionId?: string;
  }>();
  const projectIdNumber = useMemo(() => Number(projectId), [projectId]);
  const taskIdValue = useMemo(() => taskId || "", [taskId]);
  const submissionIdNumber = useMemo(() => Number(submissionId), [submissionId]);
  const [detail, setDetail] = useState<ModelResponseReviewSubmissionRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadDetail = async ({ silent = false }: { silent?: boolean } = {}) => {
    const requestId = ++requestIdRef.current;
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      setLoadError("任务参数不正确");
      return;
    }
    if (!taskIdValue && (!submissionId || Number.isNaN(submissionIdNumber) || submissionIdNumber <= 0)) {
      setLoadError("提交记录参数不正确");
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const result = taskIdValue
        ? await fetchModelResponseReviewMySubmissionDetail(projectIdNumber, taskIdValue)
        : await fetchModelResponseReviewMySubmissionDetailById(projectIdNumber, submissionIdNumber);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setDetail(result);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "加载提交详情失败，请稍后重试";
      setLoadError(errorMessage);
      setDetail(null);
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
    void loadDetail({ silent: true });
    return () => {
      requestIdRef.current += 1;
    };
  }, [projectIdNumber, taskIdValue, submissionIdNumber, submissionId]);

  return (
    <Spin spinning={loading}>
      <div className="review-page" style={{ padding: 24 }}>
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <Card className="review-card">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Space wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/user/annotation-tasks")}>
                  退出当前界面
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => void loadDetail()} loading={loading}>
                  刷新
                </Button>
              </Space>
              <div>
                <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                  试标提交详情
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  这里展示你提交审核前的试标内容，仅供查看，不能继续修改。
                </Typography.Paragraph>
              </div>
            </Space>
          </Card>

          {loadError ? <Alert type="warning" showIcon message="加载提交详情失败" description={loadError} /> : null}

          {!detail ? (
            <Card className="review-card">
              <Empty description="当前没有可查看的提交详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          ) : (
            <>
              <Card className="review-card" title="提交信息">
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  <Typography.Text>{`任务编号：${detail.task_id}`}</Typography.Text>
                  <Typography.Text>{`提交时间：${new Date(detail.submitted_at).toLocaleString()}`}</Typography.Text>
                  <Typography.Text>{`评审版本：${detail.rubric_version}`}</Typography.Text>
                </Space>
              </Card>

              <Card className="review-card" title="任务类型">
                <Typography.Paragraph style={{ marginBottom: 0 }}>{detail.task_category}</Typography.Paragraph>
              </Card>

              <Card className="review-card" title="Prompt">
                <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                  {detail.prompt_snapshot}
                </Typography.Paragraph>
              </Card>

              <Card className="review-card" title="模型回答">
                <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                  {detail.model_reply_snapshot}
                </Typography.Paragraph>
              </Card>

              <Card className="review-card" title="回答评级">
                <Typography.Paragraph style={{ marginBottom: 0 }}>{detail.answer_rating}</Typography.Paragraph>
              </Card>

              <Card className="review-card" title="评级理由">
                <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                  {detail.rating_reason}
                </Typography.Paragraph>
              </Card>
            </>
          )}
        </Space>
      </div>
    </Spin>
  );
}
