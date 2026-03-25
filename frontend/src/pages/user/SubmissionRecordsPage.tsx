import { EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Space, Table, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMySubmissionRecords } from "../../services/api";
import type { UserSubmissionRecordItem } from "../../types/api";
import { readSession } from "../../utils/session";

function buildDetailPath(record: UserSubmissionRecordItem): string | null {
  if (!record.project_id) {
    return null;
  }
  if (record.plugin_code === "model_response_review") {
    return `/user/projects/${record.project_id}/model-response-review/records/${record.submission_id}`;
  }
  if (record.plugin_code === "single_turn_search_case") {
    return `/user/projects/${record.project_id}/single-turn-search-case/records/${record.submission_id}`;
  }
  return null;
}

export function SubmissionRecordsPage() {
  const navigate = useNavigate();
  const session = readSession();
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
    if (!session?.user.can_annotate) {
      return;
    }
    void loadRecords({ silent: true });
  }, [session?.user.can_annotate]);

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
          这里汇总你提交过的试标记录，可直接进入只读详情页查看当时提交的内容。
        </Typography.Paragraph>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取提交记录失败" description={loadError} /> : null}

      {!session?.user.can_annotate ? (
        <Card className="panel-card">
          <Empty description="当前账号没有标注权限" />
        </Card>
      ) : null}

      {!session?.user.can_annotate ? null : items.length === 0 ? (
        <Card className="panel-card">
          <Empty description="当前还没有任何提交记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : (
        <Card className="panel-card" bodyStyle={{ padding: 0 }}>
          <Table<UserSubmissionRecordItem>
            rowKey={(record) => `${record.plugin_code}-${record.submission_id}`}
            dataSource={items}
            pagination={false}
            columns={[
              {
                title: "任务类型",
                dataIndex: "plugin_name",
                width: 220,
              },
              {
                title: "项目",
                dataIndex: "project_name",
                width: 220,
                render: (value: string | null) => value || "-",
              },
              {
                title: "提交内容",
                render: (_, record) => (
                  <Space direction="vertical" size={2}>
                    <Typography.Text>{record.title}</Typography.Text>
                    {record.summary ? <Typography.Text type="secondary">{record.summary}</Typography.Text> : null}
                  </Space>
                ),
              },
              {
                title: "结果摘要",
                dataIndex: "result_label",
                width: 220,
                render: (value: string | null) => value || "-",
              },
              {
                title: "提交时间",
                dataIndex: "submitted_at",
                width: 200,
                render: (value: string) => new Date(value).toLocaleString(),
              },
              {
                title: "操作",
                width: 120,
                render: (_, record) => {
                  const detailPath = buildDetailPath(record);
                  if (!detailPath) {
                    return "-";
                  }
                  return (
                    <Button icon={<EyeOutlined />} onClick={() => navigate(detailPath)}>
                      查看详情
                    </Button>
                  );
                },
              },
            ]}
          />
        </Card>
      )}
    </Space>
  );
}
