import { CheckOutlined, ReloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Progress, Row, Space, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { claimMyProjectAnnotationTask, claimMyProjectReviewTask, fetchMyTaskHall } from "../../services/api";
import type { TaskHallProjectItem } from "../../types/api";
import { readSession } from "../../utils/session";

export function TaskHallPage() {
  const navigate = useNavigate();
  const session = readSession();
  const [items, setItems] = useState<TaskHallProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHall = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchMyTaskHall();
      setItems(result.items);
      setLoadError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取任务大厅失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHall({ silent: true });
  }, []);

  const handleClaimAnnotation = async (project: TaskHallProjectItem) => {
    if (!session?.user.can_annotate) {
      return;
    }
    if (!project.can_claim_annotation) {
      if (project.current_user_annotation_owned_count > 0) {
        navigate("/user/annotation-tasks");
      }
      return;
    }

    const key = `annotation-${project.id}`;
    setActionKey(key);
    try {
      const task = await claimMyProjectAnnotationTask(project.id);
      if (!task) {
        message.warning("当前没有可领取的标注任务");
        return;
      }
      message.success("已领取标注任务，请前往标注任务页开始处理");
      navigate("/user/annotation-tasks");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "领取标注任务失败");
    } finally {
      setActionKey(null);
      await loadHall({ silent: true });
    }
  };

  const handleClaimReview = async (project: TaskHallProjectItem) => {
    if (!session?.user.can_review) {
      return;
    }
    if (!project.can_claim_review) {
      if (project.current_user_review_owned_count > 0) {
        navigate("/user/review-tasks");
      }
      return;
    }

    const key = `review-${project.id}`;
    setActionKey(key);
    try {
      const reviewTask = await claimMyProjectReviewTask(project.id);
      if (!reviewTask) {
        message.warning("当前没有可领取的质检任务");
        return;
      }
      message.success("已领取质检任务，请前往质检任务页开始处理");
      navigate("/user/review-tasks");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "领取质检任务失败");
    } finally {
      setActionKey(null);
      await loadHall({ silent: true });
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Card
        className="panel-card"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void loadHall()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          任务大厅
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          这里展示当前还能领取的标注任务和质检任务。试标未通过前每个项目只能持有 1 题，试标通过后每个项目最多可同时持有 2 题；质检任务最多可同时领取 3 个。
        </Typography.Paragraph>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取任务大厅失败" description={loadError} /> : null}

      {items.length === 0 ? (
        <Card className="panel-card">
          <Empty description="当前没有可领取的任务项目" />
        </Card>
      ) : (
        <Row gutter={[20, 20]}>
          {items.map((project) => (
            <Col xs={24} md={12} xl={8} key={project.id}>
              <Card className="panel-card">
                <Space direction="vertical" size={14} style={{ width: "100%" }}>
                  <Space wrap>
                    <Tag>{`领取进度 ${project.claim_progress_percent}%`}</Tag>
                    {project.trial_passed ? <Tag color="blue">试标已通过</Tag> : <Tag color="gold">试标未通过</Tag>}
                  </Space>

                  <div>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      {project.name}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" style={{ minHeight: 66, margin: "8px 0 0" }}>
                      {project.description || "暂无项目说明"}
                    </Typography.Paragraph>
                  </div>

                  <div>
                    <Typography.Text type="secondary">领取进度</Typography.Text>
                    <Progress percent={project.claim_progress_percent} size="small" style={{ marginTop: 8 }} />
                    <Space size={16} style={{ marginTop: 8 }} wrap>
                      <Typography.Text type="secondary">{`可领标注 ${project.annotation_available_count}`}</Typography.Text>
                      <Typography.Text type="secondary">{`可领质检 ${project.review_available_count}`}</Typography.Text>
                    </Space>
                    <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                      {`我的标注持有量 ${project.current_user_annotation_owned_count}/${project.current_user_annotation_limit}`}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                      {`我的质检持有量 ${project.current_user_total_review_owned_count}/${project.current_user_review_limit}`}
                    </Typography.Text>
                  </div>

                  <Space wrap>
                    {session?.user.can_annotate ? (
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        loading={actionKey === `annotation-${project.id}`}
                        disabled={!project.can_claim_annotation && project.current_user_annotation_owned_count === 0}
                        onClick={() => void handleClaimAnnotation(project)}
                      >
                        {project.can_claim_annotation
                          ? project.trial_passed
                            ? "领取标注"
                            : "申请领取标注"
                          : project.current_user_annotation_owned_count > 0
                            ? "去标注任务"
                            : "暂无可领标注"}
                      </Button>
                    ) : null}
                    {session?.user.can_review ? (
                      <Button
                        icon={<SafetyCertificateOutlined />}
                        loading={actionKey === `review-${project.id}`}
                        disabled={!project.can_claim_review && project.current_user_review_owned_count === 0}
                        onClick={() => void handleClaimReview(project)}
                      >
                        {project.can_claim_review
                          ? "领取质检"
                          : project.current_user_review_owned_count > 0
                            ? "去质检任务"
                            : "暂无可领质检"}
                      </Button>
                    ) : null}
                  </Space>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Space>
  );
}
