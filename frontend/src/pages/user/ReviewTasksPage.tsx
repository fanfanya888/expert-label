import { ArrowRightOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Row, Space, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMyReviewTasks } from "../../services/api";
import type { MyReviewTaskQueueItem } from "../../types/api";
import { readSession } from "../../utils/session";

function isWaitingForResubmission(item: MyReviewTaskQueueItem): boolean {
  return item.review.review_status === "waiting_resubmission";
}

function getReviewStatusTag(item: MyReviewTaskQueueItem) {
  if (item.review.review_status === "in_progress") {
    return <Tag color="blue">质检中</Tag>;
  }
  if (item.review.review_status === "waiting_resubmission") {
    return <Tag color="gold">等待标注重提</Tag>;
  }
  return <Tag>{item.review.review_status}</Tag>;
}

function getReviewStatusText(item: MyReviewTaskQueueItem): string {
  if (isWaitingForResubmission(item)) {
    return "这条质检单已被你打回，正在等待标注员重新提交。";
  }
  return "当前可继续处理这条质检任务。";
}

export function ReviewTasksPage() {
  const navigate = useNavigate();
  const session = readSession();
  const [items, setItems] = useState<MyReviewTaskQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTasks = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchMyReviewTasks();
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
    void loadTasks({ silent: true });
  }, [session?.user.can_review]);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Card
        className="panel-card"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void loadTasks()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          质检任务
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          这里按你领取的每一条质检单独展示。打回后的等待重提单会继续保留，但不会和其他质检入口合并。
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
          {items.map((item) => {
            const waitingForResubmission = isWaitingForResubmission(item);

            return (
              <Col xs={24} md={12} xl={8} key={item.review.id}>
                <Card className="panel-card" style={{ height: "100%" }} bodyStyle={{ height: "100%" }}>
                  <Space direction="vertical" size={14} style={{ width: "100%", height: "100%" }}>
                    <div>
                      <Space wrap size={[8, 8]}>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                          {item.project.name}
                        </Typography.Title>
                        {getReviewStatusTag(item)}
                      </Space>
                      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                        {`任务标识：${item.task.external_task_id}`}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                        {`质检轮次：第 ${item.review.review_round} 轮`}
                      </Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ minHeight: 66, margin: "8px 0 0" }}>
                        {item.project.description || "暂无项目说明"}
                      </Typography.Paragraph>
                    </div>

                    <div style={{ minHeight: 72 }}>
                      <Typography.Text type="secondary" style={{ display: "block" }}>
                        {`我的质检持有：${item.current_user_total_review_owned_count}/${item.current_user_review_limit}`}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                        {`当前项目已领取：${item.current_user_review_owned_count}`}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                        {getReviewStatusText(item)}
                      </Typography.Text>
                    </div>

                    <Space wrap style={{ minHeight: 32, marginTop: "auto" }}>
                      <Button
                        type="primary"
                        icon={<ArrowRightOutlined />}
                        disabled={waitingForResubmission}
                        onClick={() => navigate(`/user/projects/${item.project.id}/review/${item.review.id}`)}
                      >
                        {waitingForResubmission ? "等待重提" : "进入质检"}
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
