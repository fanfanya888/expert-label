import { ArrowRightOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Space, Typography, message } from "antd";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { login } from "../services/api";
import { getSessionHome, readSession, writeSession } from "../utils/session";

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const session = readSession();
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    return <Navigate to={getSessionHome(session)} replace />;
  }

  const handleFinish = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      const authSession = await login(values);
      writeSession(authSession);
      navigate(getSessionHome(authSession), { replace: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "登录失败，请稍后重试";
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__intro">
          <Typography.Text className="eyebrow">专家标注平台</Typography.Text>
          <Typography.Title className="login-page__title">
            统一登录入口，自动按账号分流
          </Typography.Title>
          <Typography.Paragraph className="login-page__desc">
            当前已接入真实账号登录。管理员进入管理端，用户进入用户端，不再区分超级管理员。
          </Typography.Paragraph>
        </div>
        <Card className="login-card">
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Typography.Title level={4} style={{ marginBottom: 0 }}>
              登录平台
            </Typography.Title>
            <Typography.Text type="secondary">
              登录后会根据后端返回的真实角色自动进入对应工作台。
            </Typography.Text>
          </Space>
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 16, marginBottom: 16 }}
            message="默认测试账号"
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text>管理员：admin / Admin@123</Typography.Text>
                <Typography.Text>用户：user / User@123</Typography.Text>
              </Space>
            }
          />
          <Form<LoginFormValues> layout="vertical" onFinish={handleFinish}>
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
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              icon={<ArrowRightOutlined />}
              loading={submitting}
            >
              进入平台
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
