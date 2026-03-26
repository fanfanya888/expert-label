import { ArrowRightOutlined, ClockCircleOutlined, EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Row, Space, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMyAnnotationTasks } from "../../services/api";
import type { MyAnnotationTaskQueueItem } from "../../types/api";
import { readSession } from "../../utils/session";

function resolveProjectEntryPath(item: MyAnnotationTaskQueueItem): string | null {
  if (!item.project.entry_path) {
    return null;
  }
  return item.project.entry_path.replace("{project_id}", String(item.project.id));
}

function resolveTaskRoute(item: MyAnnotationTaskQueueItem): string | null {
  if (item.project.plugin_code === "model_response_review") {
    return `/user/projects/${item.project.id}/model-response-review/tasks/${encodeURIComponent(item.task.external_task_id)}`;
  }
  if (item.project.plugin_code === "single_turn_search_case") {
    return `/user/projects/${item.project.id}/single-turn-search-case/tasks/${encodeURIComponent(item.task.external_task_id)}`;
  }
  return resolveProjectEntryPath(item);
}

function resolveReadonlyDetailRoute(item: MyAnnotationTaskQueueItem): string | null {
  if (item.project.plugin_code === "model_response_review") {
    return `/user/projects/${item.project.id}/model-response-review/submissions/${encodeURIComponent(item.task.external_task_id)}`;
  }
  if (item.project.plugin_code === "single_turn_search_case") {
    return `/user/projects/${item.project.id}/single-turn-search-case/submissions/${encodeURIComponent(item.task.external_task_id)}`;
  }
  return null;
}

function isAwaitingReview(item: MyAnnotationTaskQueueItem): boolean {
  return item.task.task_status !== "annotation_in_progress";
}

function isReturnedForRework(item: MyAnnotationTaskQueueItem): boolean {
  return item.task.task_status === "annotation_in_progress" && item.task.latest_review_status === "waiting_resubmission";
}

function getTaskStatusTag(item: MyAnnotationTaskQueueItem) {
  if (isReturnedForRework(item)) {
    return <Tag color="volcano">已打回，请返修</Tag>;
  }
  if (item.task.task_status === "annotation_in_progress") {
    return <Tag color="blue">进行中</Tag>;
  }
  if (item.task.task_status === "pending_review_dispatch") {
    return <Tag color="gold">待分发质检</Tag>;
  }
  if (item.task.task_status === "review_pending") {
    return <Tag color="orange">待质检领取</Tag>;
  }
  if (item.task.task_status === "review_in_progress") {
    return <Tag color="purple">质检中</Tag>;
  }
  if (item.task.task_status === "review_submitted") {
    return <Tag color="cyan">待管理员处理</Tag>;
  }
  return <Tag>{item.task.task_status}</Tag>;
}

function getStatusText(item: MyAnnotationTaskQueueItem): string {
  if (isReturnedForRework(item)) {
    return "该任务已被质检打回，请根据批注返修后重新提交。";
  }
  if (item.task.task_status === "annotation_in_progress") {
    return item.trial_passed ? "当前任务可继续编辑并提交。" : "当前试标任务可继续编辑并提交。";
  }
  if (item.task.task_status === "pending_review_dispatch") {
    return "标注已提交，系统正在准备进入质检流程。";
  }
  if (item.task.task_status === "review_pending") {
    return "标注已提交，正在等待质检员领取。";
  }
  if (item.task.task_status === "review_in_progress") {
    return "标注已提交，质检员正在审核。";
  }
  if (item.task.task_status === "review_submitted") {
    return "质检已完成，正在等待管理员最终处理。";
  }
  return "当前任务状态已更新，请刷新后查看最新结果。";
}

export function MyProjectsPage() {
  const navigate = useNavigate();
  const session = readSession();
  const [items, setItems] = useState<MyAnnotationTaskQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTasks = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchMyAnnotationTasks();
      setItems(result.items);
      setLoadError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取标注任务失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.user.can_annotate) {
      return;
    }
    void loadTasks({ silent: true });
  }, [session?.user.can_annotate]);

  const enterAnnotation = (item: MyAnnotationTaskQueueItem) => {
    if (item.project.external_url) {
      window.open(item.project.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    const entryPath = resolveTaskRoute(item);
    if (entryPath) {
      navigate(entryPath);
      return;
    }

    navigate(`/user/projects/${item.project.id}/workspace`);
  };

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
          标注任务
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          这里按你实际领取的每一条任务单独展示。同一项目领取多条任务后，不再合并成一个入口。
        </Typography.Paragraph>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取标注任务失败" description={loadError} /> : null}

      {!session?.user.can_annotate ? (
        <Card className="panel-card">
          <Empty description="当前账号没有标注权限" />
        </Card>
      ) : null}

      {!session?.user.can_annotate ? null : items.length === 0 ? (
        <Card className="panel-card">
          <Empty description="你还没有领取任何标注任务" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => navigate("/user/task-hall")}>
              去任务大厅领取
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[20, 20]}>
          {items.map((item) => {
            const waitingForReview = isAwaitingReview(item);
            const detailPath = waitingForReview ? resolveReadonlyDetailRoute(item) : null;

            return (
              <Col xs={24} md={12} xl={8} key={`${item.project.id}-${item.task.external_task_id}`}>
                <Card className="panel-card" style={{ height: "100%" }} bodyStyle={{ height: "100%" }}>
                  <Space direction="vertical" size={14} style={{ width: "100%", height: "100%" }}>
                    <div>
                      <Space wrap size={[8, 8]}>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                          {item.project.name}
                        </Typography.Title>
                        {getTaskStatusTag(item)}
                      </Space>
                      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                        {`任务标识：${item.task.external_task_id}`}
                      </Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ minHeight: 66, margin: "8px 0 0" }}>
                        {item.project.description || "暂无项目说明"}
                      </Typography.Paragraph>
                    </div>

                    <div style={{ minHeight: 72 }}>
                      <Typography.Text type="secondary" style={{ display: "block" }}>
                        {`当前项目已领取：${item.current_user_annotation_owned_count}/${item.current_user_annotation_limit}`}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                        {getStatusText(item)}
                      </Typography.Text>
                    </div>

                    <Space wrap style={{ minHeight: 32, marginTop: "auto" }}>
                      {waitingForReview ? (
                        <Button icon={<ClockCircleOutlined />} disabled>
                          审核处理中
                        </Button>
                      ) : (
                        <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => enterAnnotation(item)}>
                          {isReturnedForRework(item) ? "进入返修" : item.trial_passed ? "进入任务" : "进入试标"}
                        </Button>
                      )}
                      {detailPath ? (
                        <Button icon={<EyeOutlined />} onClick={() => navigate(detailPath)}>
                          查看结果
                        </Button>
                      ) : null}
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
