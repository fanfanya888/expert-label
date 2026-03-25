import { DatabaseOutlined, DeploymentUnitOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Card, Col, List, Row, Space, Statistic, Tag, Typography } from "antd";

const quickItems = [
  "管理端支持项目发布、任务流转和账号权限管理。",
  "用户端按标注任务和质检任务拆分工作入口。",
  "平台当前已具备真实登录、共享任务池和多轮质检基础闭环。",
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
              当前平台聚焦专家标注任务的统一分发和质检闭环。
              管理端负责项目发布、任务池调度和多轮质检，用户端负责试标和质检执行。
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
