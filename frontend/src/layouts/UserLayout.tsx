import { AppstoreOutlined } from "@ant-design/icons";

import { ConsoleLayout, type ConsoleMenuItem } from "./ConsoleLayout";

const menuItems: ConsoleMenuItem[] = [
  {
    key: "/user/projects",
    icon: <AppstoreOutlined />,
    label: "我的项目",
  },
];

const pageTitles: Record<string, string> = {
  "/user/projects": "我的项目",
};

export function UserLayout() {
  return (
    <ConsoleLayout
      portal="user"
      badgeText="用户工作台"
      brandSubtitle="用户端"
      headerSubtitle="用户端只展示已发布项目，并提供统一进入标注的入口。"
      defaultKey="/user/projects"
      menuItems={menuItems}
      pageTitles={pageTitles}
    />
  );
}
