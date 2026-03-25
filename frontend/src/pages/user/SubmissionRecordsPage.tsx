import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";

import { fetchMySubmissionRecords } from "../../services/api";
import type { UserSubmissionRecordItem } from "../../types/api";
import { readSession } from "../../utils/session";

function getSubmissionTypeMeta(submissionType: UserSubmissionRecordItem["submission_type"]) {
  if (submissionType === "review") {
    return { color: "purple", label: "质检任务" };
  }
  return { color: "blue", label: "标注任务" };
}

function getStatusMeta(status: string | null) {
  if (status === "pending_review_dispatch") {
    return { color: "orange", label: "待发起质检" };
  }
  if (status === "review_pending") {
    return { color: "gold", label: "待质检" };
  }
  if (status === "review_in_progress") {
    return { color: "processing", label: "质检中" };
  }
  if (status === "review_submitted") {
    return { color: "cyan", label: "审核中" };
  }
  if (status === "approved") {
    return { color: "success", label: "已通过" };
  }
  if (status === "annotation_in_progress") {
    return { color: "default", label: "标注中" };
  }
  if (status === "annotation_pending") {
    return { color: "default", label: "待领取" };
  }
  return status ? { color: "default", label: status } : null;
}

export function SubmissionRecordsPage() {
  const session = readSession();
  const canAccessRecords = Boolean(session?.user.can_annotate || session?.user.can_review);
  const [items, setItems] = useState<UserSubmissionRecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRecords = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchMySubmissionRecords();
      setItems(result.items);
      setLoadError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取提交记录失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccessRecords) {
      return;
    }
    void loadRecords({ silent: true });
  }, [canAccessRecords]);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Card
        className="panel-card"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void loadRecords()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          提交记录
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          这里统一汇总你提交过的标注记录和质检记录，只保留任务类型、所属项目、当前状态和提交时间。
        </Typography.Paragraph>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取提交记录失败" description={loadError} /> : null}

      {!canAccessRecords ? (
        <Card className="panel-card">
          <Empty description="当前账号没有可查看的提交记录权限" />
        </Card>
      ) : null}

      {!canAccessRecords ? null : items.length === 0 ? (
        <Card className="panel-card">
          <Empty description="当前还没有任何提交记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : (
        <Card className="panel-card" bodyStyle={{ padding: 0 }}>
          <Table<UserSubmissionRecordItem>
            rowKey={(record) => `${record.submission_type}-${record.plugin_code}-${record.submission_id}`}
            dataSource={items}
            pagination={false}
            columns={[
              {
                title: "提交类型",
                dataIndex: "submission_type",
                width: 160,
                render: (_, record) => {
                  const typeMeta = getSubmissionTypeMeta(record.submission_type);
                  return <Tag color={typeMeta.color}>{typeMeta.label}</Tag>;
                },
              },
              {
                title: "项目",
                dataIndex: "project_name",
                width: 220,
                render: (value: string | null) => value || "-",
              },
              {
                title: "当前状态",
                dataIndex: "current_status",
                width: 140,
                render: (value: string | null) => {
                  const meta = getStatusMeta(value);
                  return meta ? <Tag color={meta.color}>{meta.label}</Tag> : "-";
                },
              },
              {
                title: "提交时间",
                dataIndex: "submitted_at",
                width: 200,
                render: (value: string) => new Date(value).toLocaleString(),
              },
            ]}
          />
        </Card>
      )}
    </Space>
  );
}
