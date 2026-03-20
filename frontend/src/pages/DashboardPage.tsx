import { DatabaseOutlined, DeploymentUnitOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Card, Col, List, Row, Space, Statistic, Tag, Typography } from "antd";

const quickItems = [
  "管理端支持查看微服务项目、发布和下线。",
  "用户端只展示已发布项目，并提供统一进入标注入口。",
  "当前阶段不实现认证闭环、标注流程编排和 LLM 接入。",
];

export function DashboardPage() {
  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Row gutter={[20, 20]}>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic title="后端框架" value="FastAPI" prefix={<DeploymentUnitOutlined />} />
            <Tag color="blue">后端已接入</Tag>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic title="数据库" value="PostgreSQL 16" prefix={<DatabaseOutlined />} />
            <Tag color="green">数据库已配置</Tag>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic title="前端框架" value="React + Ant Design" prefix={<ThunderboltOutlined />} />
            <Tag color="gold">管理端已就绪</Tag>
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={15}>
          <Card title="平台概览" className="panel-card">
            <Typography.Paragraph>
              当前平台聚焦“微服务项目的发布管理中心”。标注项目由外部微服务创建并接入，
              本平台负责展示项目、发布与下线控制，以及用户端可见性管理。
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title="当前能力" className="panel-card">
            <List dataSource={quickItems} renderItem={(item) => <List.Item>{item}</List.Item>} />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
