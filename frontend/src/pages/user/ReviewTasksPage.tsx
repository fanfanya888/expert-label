import { CheckOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Row, Space, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMyReviewProjects } from "../../services/api";
import type { ProjectItem } from "../../types/api";

export function ReviewTasksPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProjects = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchMyReviewProjects();
      setItems(result.items);
      setLoadError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取质检项目失败，请稍后重试";
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
          这里展示当前可以领取质检任务的项目。进入项目后，系统会自动从共享质检池领取一条未被别人占用的质检任务。
        </Typography.Paragraph>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取质检项目失败" description={loadError} /> : null}

      {items.length === 0 ? (
        <Card className="panel-card">
          <Empty description="当前没有待领取的质检项目" />
        </Card>
      ) : (
        <Row gutter={[20, 20]}>
          {items.map((project) => (
            <Col xs={24} md={12} xl={8} key={project.id}>
              <Card className="panel-card">
                <Space direction="vertical" size={14} style={{ width: "100%" }}>
                  <Space wrap>
                    <Tag color="gold">待质检</Tag>
                    <Tag>{project.task_pending}</Tag>
                  </Space>

                  <div>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      {project.name}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" style={{ minHeight: 66, margin: "8px 0 0" }}>
                      {project.description || "暂无项目说明"}
                    </Typography.Paragraph>
                  </div>

                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => navigate(`/user/projects/${project.id}/review`)}
                  >
                    进入质检
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Space>
  );
}
