import { AppstoreOutlined } from "@ant-design/icons";

import { ConsoleLayout, type ConsoleMenuItem } from "./ConsoleLayout";
import { readSession } from "../utils/session";

export function UserLayout() {
  const session = readSession();
  const menuItems: ConsoleMenuItem[] = [];
  const pageTitles: Record<string, string> = {};

  if (session?.user.can_annotate || session?.user.can_review) {
    menuItems.push({
      key: "/user/task-hall",
      icon: <AppstoreOutlined />,
      label: "任务大厅",
    });
    pageTitles["/user/task-hall"] = "任务大厅";
  }

  if (session?.user.can_annotate) {
    menuItems.push({
      key: "/user/annotation-tasks",
      icon: <AppstoreOutlined />,
      label: "标注任务",
    });
    pageTitles["/user/annotation-tasks"] = "标注任务";

    menuItems.push({
      key: "/user/submission-records",
      icon: <AppstoreOutlined />,
      label: "提交记录",
    });
    pageTitles["/user/submission-records"] = "提交记录";
  }

  if (session?.user.can_review) {
    menuItems.push({
      key: "/user/review-tasks",
      icon: <AppstoreOutlined />,
      label: "质检任务",
    });
    pageTitles["/user/review-tasks"] = "质检任务";
  }

  const defaultKey = menuItems[0]?.key || "/user/task-hall";

  return (
    <ConsoleLayout
      portal="user"
      badgeText="用户工作台"
      brandSubtitle="用户端"
      headerSubtitle="先在任务大厅查看可领取任务，再进入标注任务、提交记录和质检任务处理自己的工作。"
      defaultKey={defaultKey}
      menuItems={menuItems}
      pageTitles={pageTitles}
    />
  );
}
