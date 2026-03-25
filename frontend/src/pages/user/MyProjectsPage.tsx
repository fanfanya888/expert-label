import { ArrowRightOutlined, ClockCircleOutlined, EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Row, Space, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMyTaskHall } from "../../services/api";
import type { TaskHallProjectItem } from "../../types/api";
import { readSession } from "../../utils/session";

function resolveProjectEntryPath(project: TaskHallProjectItem): string | null {
  if (!project.entry_path) {
    return null;
  }
  return project.entry_path.replace("{project_id}", String(project.id));
}

function resolvePluginRoute(project: TaskHallProjectItem): string | null {
  if (project.plugin_code === "model_response_review") {
    return `/user/projects/${project.id}/model-response-review`;
  }
  if (project.plugin_code === "single_turn_search_case") {
    return `/user/projects/${project.id}/single-turn-search-case`;
  }
  return resolveProjectEntryPath(project);
}

function resolveReadonlyDetailRoute(project: TaskHallProjectItem): string | null {
  if (!project.current_user_task_id) {
    return null;
  }
  if (project.plugin_code === "model_response_review") {
    return `/user/projects/${project.id}/model-response-review/submissions/${encodeURIComponent(project.current_user_task_id)}`;
  }
  if (project.plugin_code === "single_turn_search_case") {
    return `/user/projects/${project.id}/single-turn-search-case/submissions/${encodeURIComponent(project.current_user_task_id)}`;
  }
  return null;
}

function isAwaitingReview(project: TaskHallProjectItem): boolean {
  return Boolean(project.current_user_task_status && project.current_user_task_status !== "annotation_in_progress");
}

function getStatusText(project: TaskHallProjectItem): string {
  if (isAwaitingReview(project)) {
    return "当前最新试标已提交，正在等待管理员审核。";
  }
  if (project.current_user_annotation_owned_count > 0) {
    return "当前有可继续处理的试标题目。";
  }
  if (project.trial_passed) {
    return "试标已通过，可继续领取更多题目。";
  }
  return "试标未通过前，该项目最多只能持有 1 题。";
}

export function MyProjectsPage() {
  const navigate = useNavigate();
  const session = readSession();
  const [items, setItems] = useState<TaskHallProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const ownedItems = useMemo(
    () => items.filter((item) => item.current_user_annotation_owned_count > 0),
    [items],
  );

  const loadProjects = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchMyTaskHall();
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
    void loadProjects({ silent: true });
  }, [session?.user.can_annotate]);

  const enterAnnotation = (project: TaskHallProjectItem) => {
    if (project.external_url) {
      window.open(project.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    const entryPath = resolvePluginRoute(project);
    if (entryPath) {
      navigate(entryPath);
      return;
    }

    navigate(`/user/projects/${project.id}/workspace`);
  };

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
          标注任务
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          这里只显示你已经领取的标注项目。领取新题请先到任务大厅，领取成功后再回到这里开始试标或查看审核状态。
        </Typography.Paragraph>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取标注任务失败" description={loadError} /> : null}

      {!session?.user.can_annotate ? (
        <Card className="panel-card">
          <Empty description="当前账号没有标注权限" />
        </Card>
      ) : null}

      {!session?.user.can_annotate ? null : ownedItems.length === 0 ? (
        <Card className="panel-card">
          <Empty description="你还没有领取任何标注任务" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => navigate("/user/task-hall")}>
              去任务大厅领取
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[20, 20]}>
          {ownedItems.map((project) => {
            const waitingForReview = isAwaitingReview(project);
            const detailPath = resolveReadonlyDetailRoute(project);

            return (
              <Col xs={24} md={12} xl={8} key={project.id}>
                <Card className="panel-card">
                  <Space direction="vertical" size={14} style={{ width: "100%" }}>
                    <div>
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        {project.name}
                      </Typography.Title>
                      <Typography.Paragraph type="secondary" style={{ minHeight: 66, margin: "8px 0 0" }}>
                        {project.description || "暂无项目说明"}
                      </Typography.Paragraph>
                    </div>

                    <div>
                      <Typography.Text type="secondary" style={{ display: "block" }}>
                        {`已领取题数：${project.current_user_annotation_owned_count}/${project.current_user_annotation_limit}`}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                        {getStatusText(project)}
                      </Typography.Text>
                    </div>

                    <Space wrap>
                      {waitingForReview ? (
                        <Button icon={<ClockCircleOutlined />} disabled>
                          待审核
                        </Button>
                      ) : (
                        <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => enterAnnotation(project)}>
                          开始试标
                        </Button>
                      )}
                      {detailPath ? (
                        <Button icon={<EyeOutlined />} onClick={() => navigate(detailPath)}>
                          查看详情
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
