import { ArrowRightOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
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
      const errorMessage =
        error instanceof Error ? error.message : "获取项目列表失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(`获取项目列表失败：${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects({ silent: true });
  }, []);

  const enterProject = (project: ProjectItem) => {
    if (project.external_url) {
      window.open(project.external_url, "_blank", "noopener,noreferrer");
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
          这里只展示已经发布的微服务项目。你可以查看项目基础信息，并从平台统一进入标注入口。
        </Typography.Paragraph>
      </Card>

      {loadError ? (
        <Alert type="warning" showIcon message="获取项目列表失败" description={loadError} />
      ) : null}

      <Spin spinning={loading}>
        {items.length === 0 ? (
          <Card className="panel-card">
            <Empty description="当前没有可见的已发布项目" />
          </Card>
        ) : (
          <Row gutter={[20, 20]}>
            {items.map((project) => (
              <Col xs={24} md={12} xl={8} key={project.id}>
                <Card className="panel-card">
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Space wrap>
                      <Tag color="green">已发布</Tag>
                      {project.external_url ? (
                        <Tag color="blue">外部标注入口</Tag>
                      ) : (
                        <Tag>工作台占位页</Tag>
                      )}
                    </Space>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      {project.name}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" style={{ minHeight: 66, marginBottom: 0 }}>
                      {project.description || "暂无项目说明。"}
                    </Typography.Paragraph>
                    <Typography.Text type="secondary">
                      发布时间：{project.published_at ? new Date(project.published_at).toLocaleString() : "-"}
                    </Typography.Text>
                    <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => enterProject(project)}>
                      进入标注
                    </Button>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </Space>
  );
}
