import { ArrowRightOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Segmented, Space, Typography } from "antd";
import { Navigate, useNavigate } from "react-router-dom";

import type { UserRole } from "../types/api";
import { getRoleHome, readMockSession, writeMockSession } from "../utils/mockSession";

interface LoginFormValues {
  username: string;
  password: string;
  role: UserRole;
}

const roleOptions = [
  { label: "超级管理员", value: "super_admin" },
  { label: "管理员", value: "admin" },
  { label: "标注员", value: "annotator" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const session = readMockSession();

  if (session) {
    return <Navigate to={getRoleHome(session.role)} replace />;
  }

  const handleFinish = (values: LoginFormValues) => {
    writeMockSession({
      role: values.role,
      username: values.username,
    });
    navigate(getRoleHome(values.role), { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__intro">
          <Typography.Text className="eyebrow">专家标注平台</Typography.Text>
          <Typography.Title className="login-page__title">
            统一登录入口，按角色分流
          </Typography.Title>
          <Typography.Paragraph className="login-page__desc">
            当前阶段仍使用模拟角色进行登录分流。超级管理员和管理员进入管理端，标注员进入用户端。
          </Typography.Paragraph>
        </div>
        <Card className="login-card">
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Typography.Title level={4} style={{ marginBottom: 0 }}>
              登录平台
            </Typography.Title>
            <Typography.Text type="secondary">
              后续接入真实认证后，只需要将这里的模拟登录替换为后端返回的角色信息。
            </Typography.Text>
          </Space>
          <Form<LoginFormValues>
            layout="vertical"
            initialValues={{ role: "super_admin" }}
            onFinish={handleFinish}
          >
            <Form.Item
              label="账号角色"
              name="role"
              rules={[{ required: true, message: "请选择账号角色" }]}
            >
              <Segmented block options={roleOptions} />
            </Form.Item>
            <Form.Item
              label="账号"
              name="username"
              rules={[{ required: true, message: "请输入账号" }]}
            >
              <Input placeholder="请输入账号" size="large" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password placeholder="请输入密码" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block icon={<ArrowRightOutlined />}>
              进入平台
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
