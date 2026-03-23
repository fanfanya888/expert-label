import { ArrowLeftOutlined, LinkOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Empty, Progress, Space, Spin, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { fetchMyProjectDetail } from "../../services/api";
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

function getPublishStatusText(status: string): string {
  if (status === "published") {
    return "已发布";
  }
  if (status === "offline") {
    return "已下线";
  }
  return status;
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

function getEntryButtonText(project: ProjectItem): string {
  if (project.plugin_code === "model_response_review") {
    return "进入模型回答评审";
  }
  if (project.plugin_code === "single_turn_search_case") {
    return "进入搜索 Case 生产";
  }
  return "进入任务";
}

export function ProjectWorkspacePage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        setProject(null);
        setLoadError("项目参数缺失");
        return;
      }

      setLoading(true);
      try {
        const detail = await fetchMyProjectDetail(Number(projectId));
        setProject(detail);
        setLoadError(null);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "获取项目详情失败，请稍后重试";
        setLoadError(errorMessage);
        setProject(null);
      } finally {
        setLoading(false);
      }
    };

    void loadProject();
  }, [projectId]);

  const entryPath = useMemo(() => (project ? resolvePluginRoute(project) : null), [project]);
  const progressPercent = useMemo(() => {
    if (!project || project.task_total === 0) {
      return 0;
    }
    return Math.round((project.task_completed / project.task_total) * 100);
  }, [project]);

  const openPluginPage = () => {
    if (project?.external_url) {
      window.open(project.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (entryPath) {
      navigate(entryPath);
      return;
    }
    if (project?.plugin_code === "model_response_review" && projectId) {
      navigate(`/user/projects/${projectId}/model-response-review`);
      return;
    }
    if (project?.plugin_code === "single_turn_search_case" && projectId) {
      navigate(`/user/projects/${projectId}/single-turn-search-case`);
    }
  };

  return (
    <Spin spinning={loading}>
      <Card className="panel-card">
        {!project ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {loadError ? <Alert type="warning" showIcon message="获取项目详情失败" description={loadError} /> : null}
            <Empty description="未找到可访问的项目" />
          </Space>
        ) : (
          <Space direction="vertical" size={20} style={{ width: "100%" }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/user/projects")}>
              返回我的项目
            </Button>

            <div>
              <Typography.Title level={4} style={{ marginBottom: 8 }}>
                {project.name}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                当前页面展示项目基础信息、任务进度和统一入口。平台负责项目发布与任务上下线控制，具体作业表单由插件页面承载。
              </Typography.Paragraph>
            </div>

            <Card size="small">
              <Typography.Text type="secondary">任务进度</Typography.Text>
              <Progress
                percent={progressPercent}
                status="active"
                format={() => `${project.task_completed}/${project.task_total}`}
                style={{ marginTop: 8 }}
              />
            </Card>

            <Descriptions column={1} bordered>
              <Descriptions.Item label="项目说明">{project.description || "暂无项目说明"}</Descriptions.Item>
              <Descriptions.Item label="插件类型">{project.plugin_code || "-"}</Descriptions.Item>
              <Descriptions.Item label="来源类型">{getSourceTypeText(project.source_type || "-")}</Descriptions.Item>
              <Descriptions.Item label="发布状态">{getPublishStatusText(project.publish_status)}</Descriptions.Item>
              <Descriptions.Item label="用户可见">{project.is_visible ? "是" : "否"}</Descriptions.Item>
              <Descriptions.Item label="发布时间">
                {project.published_at ? new Date(project.published_at).toLocaleString() : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="任务统计">
                {`总任务 ${project.task_total} / 已完成 ${project.task_completed} / 待完成 ${project.task_pending}`}
              </Descriptions.Item>
              <Descriptions.Item label="统一入口">
                {project.external_url ? (
                  <a href={project.external_url} target="_blank" rel="noreferrer">
                    <Space size={4}>
                      <LinkOutlined />
                      <span>打开外部入口</span>
                    </Space>
                  </a>
                ) : entryPath ? (
                  entryPath
                ) : (
                  "未配置外部入口，将使用平台内插件页面"
                )}
              </Descriptions.Item>
            </Descriptions>

            <Space wrap>
              <Button type="primary" onClick={openPluginPage}>
                {getEntryButtonText(project)}
              </Button>
              {project.external_url ? (
                <Button href={project.external_url} target="_blank" rel="noreferrer">
                  打开外部入口
                </Button>
              ) : null}
            </Space>
          </Space>
        )}
      </Card>
    </Spin>
  );
}
