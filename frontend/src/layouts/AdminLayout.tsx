import {
  DashboardOutlined,
  InfoCircleOutlined,
  ProjectOutlined,
  TeamOutlined,
} from "@ant-design/icons";

import { ConsoleLayout, type ConsoleMenuItem } from "./ConsoleLayout";

const menuItems: ConsoleMenuItem[] = [
  {
    key: "/admin/dashboard",
    icon: <DashboardOutlined />,
    label: "控制台",
  },
  {
    key: "/admin/projects",
    icon: <ProjectOutlined />,
    label: "项目管理",
  },
  {
    key: "/admin/accounts",
    icon: <TeamOutlined />,
    label: "账号管理",
  },
  {
    key: "/admin/system",
    icon: <InfoCircleOutlined />,
    label: "系统信息",
  },
];

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "控制台",
  "/admin/projects": "项目管理",
  "/admin/accounts": "账号管理",
  "/admin/system": "系统信息",
};

export function AdminLayout() {
  return (
    <ConsoleLayout
      portal="admin"
      badgeText="管理控制台"
      brandSubtitle="平台管理端"
      headerSubtitle="管理端负责账号管理、项目发布管理和系统信息查看。"
      defaultKey="/admin/dashboard"
      menuItems={menuItems}
      pageTitles={pageTitles}
    />
  );
}
