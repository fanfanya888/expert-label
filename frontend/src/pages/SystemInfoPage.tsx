import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Descriptions, Empty, Row, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";

import { fetchSystemInfo, pingSystem } from "../services/api";
import type { PluginMeta, SystemInfo } from "../types/api";

export function SystemInfoPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [ping, setPing] = useState<string>("-");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSystemInfo = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const [systemInfo, pingData] = await Promise.all([fetchSystemInfo(), pingSystem()]);
      setInfo(systemInfo);
      setPing(new Date(pingData.now).toLocaleString());
      setLoadError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "获取系统信息失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(`获取系统信息失败：${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSystemInfo({ silent: true });
  }, []);

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card
        title="系统概览"
        className="panel-card"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void loadSystemInfo()} loading={loading}>
            刷新
          </Button>
        }
      >
        {loadError && !info ? (
          <Alert type="warning" showIcon message="获取系统信息失败" description={loadError} />
        ) : info ? (
          <Descriptions column={{ xs: 1, md: 2 }} labelStyle={{ width: 120 }}>
            <Descriptions.Item label="应用名称">{info.app_name}</Descriptions.Item>
            <Descriptions.Item label="运行环境">
              <Tag color={info.environment === "production" ? "red" : "blue"}>{info.environment}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="调试模式">{info.debug ? "开启" : "关闭"}</Descriptions.Item>
            <Descriptions.Item label="API 前缀">{info.api_prefix}</Descriptions.Item>
            <Descriptions.Item label="Redis 预留">{info.redis_enabled ? "已配置" : "未启用"}</Descriptions.Item>
            <Descriptions.Item label="最近心跳">{ping}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="暂无系统信息" />
        )}
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={12}>
          <Card title="页面说明" className="panel-card">
            <Typography.Paragraph>
              系统信息页会调用后端的系统接口，用于查看当前环境配置、基础运行状态和已注册插件信息。
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="已注册插件" className="panel-card">
            <Table<PluginMeta>
              rowKey="key"
              dataSource={Array.isArray(info?.plugins) ? info.plugins : []}
              pagination={false}
              locale={{ emptyText: "暂无插件" }}
              columns={[
                { title: "插件标识", dataIndex: "key" },
                { title: "名称", dataIndex: "name" },
                { title: "版本", dataIndex: "version" },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
