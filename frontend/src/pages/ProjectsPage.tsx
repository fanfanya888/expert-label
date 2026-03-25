import { CheckCircleOutlined, ProfileOutlined, ReloadOutlined, StopOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchAdminProjects, publishAdminProject, unpublishAdminProject } from "../services/api";
import type { ProjectItem } from "../types/api";

function getPublishStatusText(status: string): string {
  if (status === "published") {
    return "已发布";
  }
  if (status === "offline") {
    return "已下线";
  }
  return status;
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProjects = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchAdminProjects();
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

  const handlePublishToggle = async (project: ProjectItem) => {
    setPublishingId(project.id);
    try {
      if (project.is_published) {
        await unpublishAdminProject(project.id);
        message.success("项目已下线");
      } else {
        await publishAdminProject(project.id);
        message.success("项目已发布");
      }
      await loadProjects({ silent: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : project.is_published ? "下线项目失败" : "发布项目失败";
      message.error(errorMessage);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      {loadError ? <Alert type="warning" showIcon message="获取项目列表失败" description={loadError} /> : null}

      <Card
        title="项目列表"
        className="panel-card"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void loadProjects()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Table<ProjectItem>
          rowKey="id"
          dataSource={Array.isArray(items) ? items : []}
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无项目" /> }}
          columns={[
            {
              title: "项目",
              render: (_, record) => (
                <Space direction="vertical" size={4}>
                  <Typography.Text strong>{record.name}</Typography.Text>
                  <Typography.Text type="secondary">{record.description || "暂无项目说明"}</Typography.Text>
                </Space>
              ),
            },
            {
              title: "发布状态",
              render: (_, record) => (
                <Space direction="vertical" size={6}>
                  <Tag color={record.is_published ? "green" : "default"}>
                    {record.is_published ? "已发布" : "未发布"}
                  </Tag>
                  <Typography.Text type="secondary">{getPublishStatusText(record.publish_status)}</Typography.Text>
                  <Typography.Text type="secondary">用户可见：{record.is_visible ? "是" : "否"}</Typography.Text>
                </Space>
              ),
            },
            {
              title: "任务统计",
              render: (_, record) => (
                <Space direction="vertical" size={4}>
                  <Typography.Text>总任务：{record.task_total}</Typography.Text>
                  <Typography.Text type="secondary">已完成：{record.task_completed}</Typography.Text>
                  <Typography.Text type="secondary">待完成：{record.task_pending}</Typography.Text>
                </Space>
              ),
            },
            {
              title: "发布时间",
              render: (_, record) => (record.published_at ? new Date(record.published_at).toLocaleString() : "-"),
            },
            {
              title: "操作",
              width: 220,
              render: (_, record) => (
                <Space>
                  <Button icon={<ProfileOutlined />} onClick={() => navigate(`/admin/projects/${record.id}/tasks`)}>
                    任务管理
                  </Button>
                  <Button
                    type={record.is_published ? "default" : "primary"}
                    icon={record.is_published ? <StopOutlined /> : <CheckCircleOutlined />}
                    loading={publishingId === record.id}
                    onClick={() => void handlePublishToggle(record)}
                  >
                    {record.is_published ? "下线" : "发布"}
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
