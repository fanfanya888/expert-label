import { LogoutOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, Space, Tag, Typography } from "antd";
import type { MenuProps } from "antd";
import type { ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import {
  clearMockSession,
  getPortalLabel,
  getRoleLabel,
  readMockSession,
  type PortalArea,
} from "../utils/mockSession";

const { Header, Content, Sider } = Layout;

export interface ConsoleMenuItem {
  key: string;
  icon: ReactNode;
  label: string;
}

interface ConsoleLayoutProps {
  portal: PortalArea;
  badgeText: string;
  brandSubtitle: string;
  headerSubtitle: string;
  defaultKey: string;
  menuItems: ConsoleMenuItem[];
  pageTitles: Record<string, string>;
}

export function ConsoleLayout({
  portal,
  badgeText,
  brandSubtitle,
  headerSubtitle,
  defaultKey,
  menuItems,
  pageTitles,
}: ConsoleLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = readMockSession();
  const selectedKey =
    menuItems.find((item) => location.pathname.startsWith(item.key))?.key ?? defaultKey;
  const pageTitle = pageTitles[selectedKey] ?? "平台";

  const handleLogout = () => {
    clearMockSession();
    navigate("/login", { replace: true });
  };

  return (
    <Layout className="app-shell">
      <Sider width={240} theme="light" className="app-shell__sider">
        <div className="app-shell__brand">
          <Typography.Title level={4} className="app-shell__brand-title">
            专家标注平台
          </Typography.Title>
          <Typography.Text type="secondary">{brandSubtitle}</Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems as MenuProps["items"]}
          onClick={({ key }) => navigate(key)}
          className="app-shell__menu"
        />
      </Sider>
      <Layout>
        <Header className="app-shell__header">
          <Space direction="vertical" size={2}>
            <Typography.Title level={3} className="app-shell__page-title">
              {pageTitle}
            </Typography.Title>
            <Typography.Text type="secondary">{headerSubtitle}</Typography.Text>
          </Space>
          <Space size={12} wrap>
            <Tag color={portal === "admin" ? "blue" : "green"}>{getPortalLabel(portal)}</Tag>
            {session ? <Tag>{getRoleLabel(session.role)}</Tag> : null}
            {session?.username ? (
              <Typography.Text type="secondary">{session.username}</Typography.Text>
            ) : null}
            <Tag>{badgeText}</Tag>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>
              退出登录
            </Button>
          </Space>
        </Header>
        <Content className="app-shell__content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
