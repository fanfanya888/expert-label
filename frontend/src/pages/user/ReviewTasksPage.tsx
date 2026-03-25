import { ArrowRightOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Row, Space, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMyReviewProjects } from "../../services/api";
import type { TaskHallProjectItem } from "../../types/api";
import { readSession } from "../../utils/session";

function isWaitingForResubmission(project: TaskHallProjectItem): boolean {
  return project.current_user_review_task_status === "annotation_in_progress";
}

function getReviewStatusText(project: TaskHallProjectItem): string {
  if (isWaitingForResubmission(project)) {
    return "该项目已被你打回，正在等待标注员重新提交。";
  }
  if (project.current_user_review_task_status === "review_in_progress") {
    return "当前有可继续处理的质检任务。";
  }
  return "当前项目已有你已领取的质检任务。";
}

export function ReviewTasksPage() {
  const navigate = useNavigate();
  const session = readSession();
  const [items, setItems] = useState<TaskHallProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProjects = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchMyReviewProjects();
      setItems(result.items);
      setLoadError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取质检任务失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.user.can_review) {
      return;
    }
    void loadProjects({ silent: true });
  }, [session?.user.can_review]);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Card
        className="panel-card"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void loadProjects()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          质检任务
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          这里只显示你已领取的质检项目。新的质检题目仍从任务大厅领取；如果你已经打回过某个任务，它会继续保留在这里，等标注员重提后再继续质检。
        </Typography.Paragraph>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取质检任务失败" description={loadError} /> : null}

      {!session?.user.can_review ? (
        <Card className="panel-card">
          <Empty description="当前账号没有质检权限" />
        </Card>
      ) : null}

      {!session?.user.can_review ? null : items.length === 0 ? (
        <Card className="panel-card">
          <Empty description="你还没有领取任何质检任务" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => navigate("/user/task-hall")}>
              去任务大厅领取
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[20, 20]}>
          {items.map((project) => {
            const waitingForResubmission = isWaitingForResubmission(project);
            return (
              <Col xs={24} md={12} xl={8} key={project.id}>
                <Card className="panel-card" style={{ height: "100%" }} bodyStyle={{ height: "100%" }}>
                  <Space direction="vertical" size={14} style={{ width: "100%", height: "100%" }}>
                    <div>
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        {project.name}
                      </Typography.Title>
                      <Typography.Paragraph type="secondary" style={{ minHeight: 66, margin: "8px 0 0" }}>
                        {project.description || "暂无项目说明"}
                      </Typography.Paragraph>
                    </div>

                    <div style={{ minHeight: 64 }}>
                      <Typography.Text type="secondary" style={{ display: "block" }}>
                        {`已领取质检数：${project.current_user_total_review_owned_count}/${project.current_user_review_limit}`}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                        {getReviewStatusText(project)}
                      </Typography.Text>
                    </div>

                    <Space wrap style={{ minHeight: 32, marginTop: "auto" }}>
                      <Button
                        type="primary"
                        icon={<ArrowRightOutlined />}
                        disabled={waitingForResubmission}
                        onClick={() => navigate(`/user/projects/${project.id}/review`)}
                      >
                        {waitingForResubmission ? "等待重提" : "开始质检"}
                      </Button>
                    </Space>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </Space>
  );
}
