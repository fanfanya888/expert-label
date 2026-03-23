import { ArrowRightOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMyProjects } from "../../services/api";
import type { ProjectItem } from "../../types/api";

function resolveProjectEntryPath(project: ProjectItem): string | null {
  if (!project.entry_path) {
    return null;
  }
  return project.entry_path.replace("{project_id}", String(project.id));
}

function resolvePluginRoute(project: ProjectItem): string | null {
  if (project.plugin_code === "model_response_review") {
    return `/user/projects/${project.id}/model-response-review`;
  }
  if (project.plugin_code === "single_turn_search_case") {
    return `/user/projects/${project.id}/single-turn-search-case`;
  }
  return resolveProjectEntryPath(project);
}

function getSourceTypeText(sourceType: string): string {
  if (sourceType === "plugin_seed") {
    return "插件默认项目";
  }
  if (sourceType === "unknown") {
    return "未知来源";
  }
  return sourceType;
}

export function MyProjectsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProjects = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchMyProjects();
      setItems(result.items);
      setLoadError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取项目列表失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects({ silent: true });
  }, []);

  const openWorkspace = (project: ProjectItem) => {
    navigate(`/user/projects/${project.id}/workspace`);
  };

  const enterAnnotation = (project: ProjectItem) => {
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
          我的项目
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          这里展示当前用户可见的已发布项目。你可以先查看项目概览，再进入对应的标注入口完成任务。
        </Typography.Paragraph>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取项目列表失败" description={loadError} /> : null}

      <Spin spinning={loading}>
        {items.length === 0 ? (
          <Card className="panel-card">
            <Empty description="当前没有可见的已发布项目" />
          </Card>
        ) : (
          <Row gutter={[20, 20]}>
            {items.map((project) => {
              const percent = project.task_total > 0 ? Math.round((project.task_completed / project.task_total) * 100) : 0;
              return (
                <Col xs={24} md={12} xl={8} key={project.id}>
                  <Card className="panel-card">
                    <Space direction="vertical" size={14} style={{ width: "100%" }}>
                      <Space wrap>
                        <Tag color="green">已发布</Tag>
                        {project.plugin_code ? <Tag color="blue">{project.plugin_code}</Tag> : null}
                        <Tag>{getSourceTypeText(project.source_type)}</Tag>
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
                        <Typography.Text type="secondary">任务进度</Typography.Text>
                        <Progress
                          percent={percent}
                          size="small"
                          status="active"
                          format={() => `${project.task_completed}/${project.task_total}`}
                          style={{ marginTop: 8 }}
                        />
                        <Space size={16} style={{ marginTop: 8 }}>
                          <Typography.Text type="secondary">待完成 {project.task_pending}</Typography.Text>
                          <Typography.Text type="secondary">发布时间 {project.published_at ? new Date(project.published_at).toLocaleString() : "-"}</Typography.Text>
                        </Space>
                      </div>

                      <Space wrap>
                        <Button onClick={() => openWorkspace(project)}>查看项目</Button>
                        <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => enterAnnotation(project)}>
                          进入标注
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Spin>
    </Space>
  );
}
