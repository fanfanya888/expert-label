import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      token: {
        colorPrimary: "#1f4b99",
        colorBgLayout: "#f3f6fa",
        colorBgContainer: "#ffffff",
        borderRadius: 14,
        fontFamily: "Aptos, Segoe UI, PingFang SC, sans-serif",
      },
    }}
  >
    <App />
  </ConfigProvider>,
);
