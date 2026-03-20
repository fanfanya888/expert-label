import { ArrowLeftOutlined, LinkOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Empty, Space, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { fetchMyProjectDetail } from "../../services/api";
import type { ProjectItem } from "../../types/api";

export function ProjectWorkspacePage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        return;
      }

      setLoading(true);
      try {
        const detail = await fetchMyProjectDetail(Number(projectId));
        setProject(detail);
        setLoadError(null);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "获取项目详情失败，请稍后重试";
        setLoadError(errorMessage);
        setProject(null);
      } finally {
        setLoading(false);
      }
    };

    void loadProject();
  }, [projectId]);

  return (
    <Spin spinning={loading}>
      <Card className="panel-card">
        {!project ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {loadError ? (
              <Alert type="warning" showIcon message="获取项目详情失败" description={loadError} />
            ) : null}
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
                当前阶段这里是用户进入项目后的最小占位工作台，用于承接平台统一入口。
              </Typography.Paragraph>
            </div>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="项目说明">
                {project.description || "暂无项目说明"}
              </Descriptions.Item>
              <Descriptions.Item label="发布时间">
                {project.published_at ? new Date(project.published_at).toLocaleString() : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="发布人">
                {project.published_by ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="标注入口">
                {project.external_url ? (
                  <a href={project.external_url} target="_blank" rel="noreferrer">
                    <Space size={4}>
                      <LinkOutlined />
                      <span>打开外部标注入口</span>
                    </Space>
                  </a>
                ) : (
                  "当前项目还没有配置外部标注入口，现阶段可先使用本页作为占位工作台。"
                )}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Card>
    </Spin>
  );
}
