import {
  CheckCircleOutlined,
  LinkOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Empty, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";

import {
  fetchAdminProjects,
  publishAdminProject,
  unpublishAdminProject,
} from "../services/api";
import type { ProjectItem } from "../types/api";

export function ProjectsPage() {
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
      await loadProjects();
    } catch {
      message.error(project.is_published ? "下线项目失败" : "发布项目失败");
    } finally {
      setPublishingId(null);
    }
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
          微服务项目发布管理
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          项目数据来自外部标注微服务。本平台不创建标注项目，只负责展示项目、发布与下线，以及控制用户端可见性。
        </Typography.Paragraph>
      </Card>

      {loadError ? (
        <Alert type="warning" showIcon message="获取项目列表失败" description={loadError} />
      ) : null}

      <Card title="项目列表" className="panel-card">
        <Table<ProjectItem>
          rowKey="id"
          dataSource={items}
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无项目" /> }}
          columns={[
            {
              title: "ID",
              dataIndex: "id",
              width: 80,
            },
            {
              title: "项目名称",
              dataIndex: "name",
            },
            {
              title: "项目说明",
              dataIndex: "description",
              render: (value: string | null) => value || "-",
            },
            {
              title: "发布状态",
              dataIndex: "is_published",
              render: (value: boolean) => (
                <Tag color={value ? "green" : "default"}>{value ? "已发布" : "未发布"}</Tag>
              ),
            },
            {
              title: "发布信息",
              render: (_, record) =>
                record.published_at
                  ? `${new Date(record.published_at).toLocaleString()} / ${record.published_by ?? "-"}`
                  : "-",
            },
            {
              title: "标注入口",
              render: (_, record) =>
                record.external_url ? (
                  <a href={record.external_url} target="_blank" rel="noreferrer">
                    <Space size={4}>
                      <LinkOutlined />
                      <span>打开入口</span>
                    </Space>
                  </a>
                ) : (
                  "-"
                ),
            },
            {
              title: "接入时间",
              dataIndex: "created_at",
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: "操作",
              render: (_, record) => (
                <Button
                  type={record.is_published ? "default" : "primary"}
                  icon={record.is_published ? <StopOutlined /> : <CheckCircleOutlined />}
                  loading={publishingId === record.id}
                  onClick={() => void handlePublishToggle(record)}
                >
                  {record.is_published ? "下线" : "发布"}
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
