import {
  CheckCircleOutlined,
  ProjectOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, List, Progress, Row, Space, Statistic, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";

import { fetchAdminProjects } from "../services/api";
import type { ProjectItem } from "../types/api";

function getPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "-";
}

function getPluginLabel(pluginCode: string | null) {
  if (pluginCode === "model_response_review") return "Model Response Review";
  if (pluginCode === "single_turn_search_case") return "Single Turn Search Case";
  return pluginCode || "未配置插件";
}

function buildDonutStyle(primaryValue: number, secondaryValue: number, color: string) {
  const total = primaryValue + secondaryValue;
  const percent = getPercent(primaryValue, total);
  return {
    background: `conic-gradient(${color} 0 ${percent}%, #e7ecf3 ${percent}% 100%)`,
    percent,
  };
}

export function DashboardPage() {
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProjects = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchAdminProjects();
      setItems(result.items);
      setLoadError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取控制台数据失败，请稍后重试";
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

  const dashboard = useMemo(() => {
    const totalProjects = items.length;
    const publishedProjects = items.filter((item) => item.publish_status === "published").length;
    const totalTasks = items.reduce((sum, item) => sum + item.task_total, 0);
    const completedTasks = items.reduce((sum, item) => sum + item.task_completed, 0);
    const pendingTasks = items.reduce((sum, item) => sum + item.task_pending, 0);
    const visibleProjects = items.filter((item) => item.is_visible).length;

    const pluginCounts = new Map<string, { label: string; count: number }>();
    items.forEach((item) => {
      const key = item.plugin_code || "unconfigured";
      const current = pluginCounts.get(key);
      if (current) {
        current.count += 1;
        return;
      }
      pluginCounts.set(key, {
        label: getPluginLabel(item.plugin_code),
        count: 1,
      });
    });

    const pluginStats = Array.from(pluginCounts.entries())
      .map(([key, value]) => ({
        key,
        ...value,
        percent: getPercent(value.count, totalProjects),
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

    const attentionProjects = [...items]
      .filter((item) => item.publish_status === "published" && item.task_pending > 0)
      .sort((left, right) => right.task_pending - left.task_pending || right.task_total - left.task_total)
      .slice(0, 5);

    return {
      totalProjects,
      publishedProjects,
      unpublishedProjects: Math.max(totalProjects - publishedProjects, 0),
      visibleProjects,
      hiddenProjects: Math.max(totalProjects - visibleProjects, 0),
      totalTasks,
      completedTasks,
      pendingTasks,
      completionRate: getPercent(completedTasks, totalTasks),
      pluginStats,
      attentionProjects,
    };
  }, [items]);

  const publishDonut = buildDonutStyle(dashboard.publishedProjects, dashboard.unpublishedProjects, "#177ddc");
  const progressDonut = buildDonutStyle(dashboard.completedTasks, dashboard.pendingTasks, "#2f855a");

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }} align="start" wrap>
        <Typography.Paragraph style={{ marginBottom: 0 }} type="secondary">
          控制台改为直接展示项目发布和任务积压情况，先看数据，再决定下一步操作。
        </Typography.Paragraph>
        <Button icon={<ReloadOutlined />} onClick={() => void loadProjects()} loading={loading}>
          刷新
        </Button>
      </Space>

      {loadError ? <Alert type="warning" showIcon message="获取控制台数据失败" description={loadError} /> : null}

      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title="项目总数" value={dashboard.totalProjects} prefix={<ProjectOutlined />} />
            <Tag color="blue">可见项目 {dashboard.visibleProjects}</Tag>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title="已发布项目" value={dashboard.publishedProjects} prefix={<CheckCircleOutlined />} />
            <Tag color="green">未发布 {dashboard.unpublishedProjects}</Tag>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title="总任务量" value={dashboard.totalTasks} prefix={<UnorderedListOutlined />} />
            <Tag color="gold">待处理 {dashboard.pendingTasks}</Tag>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title="完成率" value={dashboard.completionRate} suffix="%" prefix={<ScheduleOutlined />} />
            <Tag color="green">已完成 {dashboard.completedTasks}</Tag>
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={12}>
          <Card title="发布分布" className="panel-card">
            {dashboard.totalProjects ? (
              <div className="dashboard-donut-panel">
                <div className="dashboard-donut-ring" style={{ background: publishDonut.background }}>
                  <div className="dashboard-donut-ring__inner">
                    <Typography.Title level={3}>{publishDonut.percent}%</Typography.Title>
                    <Typography.Text type="secondary">项目已发布</Typography.Text>
                  </div>
                </div>
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <div className="dashboard-legend-row">
                    <span className="dashboard-legend-row__dot" style={{ background: "#177ddc" }} />
                    <Typography.Text>已发布</Typography.Text>
                    <Typography.Text strong>{dashboard.publishedProjects}</Typography.Text>
                  </div>
                  <div className="dashboard-legend-row">
                    <span className="dashboard-legend-row__dot" style={{ background: "#e7ecf3" }} />
                    <Typography.Text>未发布</Typography.Text>
                    <Typography.Text strong>{dashboard.unpublishedProjects}</Typography.Text>
                  </div>
                  <div className="dashboard-legend-row">
                    <span className="dashboard-legend-row__dot" style={{ background: "#91caff" }} />
                    <Typography.Text>用户可见</Typography.Text>
                    <Typography.Text strong>{dashboard.visibleProjects}</Typography.Text>
                  </div>
                </Space>
              </div>
            ) : (
              <Empty description="暂无项目数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="任务进度" className="panel-card">
            {dashboard.totalTasks ? (
              <div className="dashboard-donut-panel">
                <div className="dashboard-donut-ring" style={{ background: progressDonut.background }}>
                  <div className="dashboard-donut-ring__inner">
                    <Typography.Title level={3}>{progressDonut.percent}%</Typography.Title>
                    <Typography.Text type="secondary">任务已完成</Typography.Text>
                  </div>
                </div>
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <div className="dashboard-legend-row">
                    <span className="dashboard-legend-row__dot" style={{ background: "#2f855a" }} />
                    <Typography.Text>已完成</Typography.Text>
                    <Typography.Text strong>{dashboard.completedTasks}</Typography.Text>
                  </div>
                  <div className="dashboard-legend-row">
                    <span className="dashboard-legend-row__dot" style={{ background: "#e7ecf3" }} />
                    <Typography.Text>待完成</Typography.Text>
                    <Typography.Text strong>{dashboard.pendingTasks}</Typography.Text>
                  </div>
                  <div className="dashboard-legend-row">
                    <span className="dashboard-legend-row__dot" style={{ background: "#bfdbfe" }} />
                    <Typography.Text>总任务</Typography.Text>
                    <Typography.Text strong>{dashboard.totalTasks}</Typography.Text>
                  </div>
                </Space>
              </div>
            ) : (
              <Empty description="暂无任务数据" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={12}>
          <Card title="插件分布" className="panel-card">
            {dashboard.pluginStats.length ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                {dashboard.pluginStats.map((plugin) => (
                  <div key={plugin.key} className="dashboard-plugin-row">
                    <Space style={{ width: "100%", justifyContent: "space-between" }} align="center">
                      <Typography.Text strong>{plugin.label}</Typography.Text>
                      <Typography.Text type="secondary">{plugin.count} 个项目</Typography.Text>
                    </Space>
                    <Progress percent={plugin.percent} showInfo={false} strokeColor="#177ddc" trailColor="#edf2f7" />
                  </div>
                ))}
              </Space>
            ) : (
              <Empty description="暂无插件分布" />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="待处理项目" className="panel-card">
            {dashboard.attentionProjects.length ? (
              <List
                dataSource={dashboard.attentionProjects}
                renderItem={(item) => (
                  <List.Item className="dashboard-attention-item">
                    <Space direction="vertical" size={6} style={{ width: "100%" }}>
                      <Space size={[8, 8]} wrap>
                        <Typography.Text strong>{item.name}</Typography.Text>
                        <Tag color="orange">待完成 {item.task_pending}</Tag>
                        <Tag color="green">已发布</Tag>
                      </Space>
                      <Typography.Paragraph
                        type="secondary"
                        ellipsis={{ rows: 1, tooltip: item.description || "暂无项目说明" }}
                        style={{ marginBottom: 0 }}
                      >
                        {item.description || "暂无项目说明"}
                      </Typography.Paragraph>
                      <Space size={16} wrap>
                        <Typography.Text type="secondary">总任务 {item.task_total}</Typography.Text>
                        <Typography.Text type="secondary">已完成 {item.task_completed}</Typography.Text>
                        <Typography.Text type="secondary">最近更新 {formatDateTime(item.updated_at)}</Typography.Text>
                      </Space>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="当前没有积压项目" />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
