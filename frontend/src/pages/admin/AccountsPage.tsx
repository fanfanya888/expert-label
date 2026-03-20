import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useState } from "react";

import {
  createAdminUser,
  fetchAdminUserDetail,
  fetchAdminUsers,
  updateAdminUser,
} from "../../services/api";
import type {
  AdminUserCreatePayload,
  AdminUserItem,
  AdminUserUpdatePayload,
  UserRole,
} from "../../types/api";
import { getRoleLabel } from "../../utils/mockSession";

interface UserFormValues {
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

const roleOptions = [
  { label: "超级管理员", value: "super_admin" },
  { label: "管理员", value: "admin" },
  { label: "标注员", value: "annotator" },
];

function roleColor(role: UserRole): string {
  if (role === "super_admin") {
    return "red";
  }
  if (role === "admin") {
    return "blue";
  }
  return "green";
}

export function AccountsPage() {
  const [form] = Form.useForm<UserFormValues>();
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadUsers = async ({ silent = false }: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const result = await fetchAdminUsers();
      setItems(result.items);
      setLoadError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "获取账号列表失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(`获取账号列表失败：${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers({ silent: true });
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({
      role: "annotator",
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = async (userId: number) => {
    setDetailLoadingId(userId);
    try {
      const detail = await fetchAdminUserDetail(userId);
      setEditingUser(detail);
      form.setFieldsValue({
        username: detail.username,
        email: detail.email,
        role: detail.role,
        is_active: detail.is_active,
      });
      setModalOpen(true);
    } catch {
      message.error("获取账号详情失败");
    } finally {
      setDetailLoadingId(null);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    form.resetFields();
  };

  const submitForm = async (values: UserFormValues) => {
    setSubmitting(true);
    try {
      if (editingUser) {
        const payload: AdminUserUpdatePayload = {
          username: values.username,
          email: values.email,
          role: values.role,
          is_active: values.is_active,
        };
        await updateAdminUser(editingUser.id, payload);
        message.success("账号已更新");
      } else {
        const payload: AdminUserCreatePayload = {
          username: values.username,
          email: values.email,
          role: values.role,
          is_active: values.is_active,
        };
        await createAdminUser(payload);
        message.success("账号已创建");
      }
      closeModal();
      await loadUsers();
    } catch {
      message.error(editingUser ? "更新账号失败" : "创建账号失败");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: AdminUserItem) => {
    try {
      await updateAdminUser(user.id, { is_active: !user.is_active });
      message.success(user.is_active ? "账号已禁用" : "账号已启用");
      await loadUsers();
    } catch {
      message.error(user.is_active ? "禁用账号失败" : "启用账号失败");
    }
  };

  return (
    <Card
      title="账号管理"
      className="panel-card"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadUsers()} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            创建账号
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">
        当前提供最小可用的账号列表、创建、编辑和启用/禁用能力，角色支持超级管理员、管理员和标注员。
      </Typography.Paragraph>

      {loadError ? (
        <Alert type="warning" showIcon message="获取账号列表失败" description={loadError} style={{ marginBottom: 16 }} />
      ) : null}

      <Table<AdminUserItem>
        rowKey="id"
        dataSource={items}
        loading={loading}
        pagination={false}
        locale={{ emptyText: "暂无账号" }}
        columns={[
          {
            title: "账号",
            dataIndex: "username",
          },
          {
            title: "邮箱",
            dataIndex: "email",
          },
          {
            title: "角色",
            dataIndex: "role",
            render: (value: UserRole) => <Tag color={roleColor(value)}>{getRoleLabel(value)}</Tag>,
          },
          {
            title: "状态",
            dataIndex: "is_active",
            render: (value: boolean) => (
              <Tag color={value ? "green" : "default"}>{value ? "启用" : "禁用"}</Tag>
            ),
          },
          {
            title: "最近登录",
            dataIndex: "last_login_at",
            render: (value: string | null) =>
              value ? new Date(value).toLocaleString() : "从未登录",
          },
          {
            title: "创建时间",
            dataIndex: "created_at",
            render: (value: string) => new Date(value).toLocaleString(),
          },
          {
            title: "操作",
            render: (_, record) => (
              <Space>
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => void openEditModal(record.id)}
                  loading={detailLoadingId === record.id}
                >
                  编辑
                </Button>
                <Popconfirm
                  title={record.is_active ? "确认禁用该账号？" : "确认启用该账号？"}
                  onConfirm={() => void toggleUserStatus(record)}
                >
                  <Button type="link">{record.is_active ? "禁用" : "启用"}</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingUser ? "编辑账号" : "创建账号"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form<UserFormValues>
          layout="vertical"
          form={form}
          onFinish={submitForm}
          initialValues={{ role: "annotator", is_active: true }}
        >
          <Form.Item
            label="账号"
            name="username"
            rules={[{ required: true, message: "请输入账号名" }]}
          >
            <Input placeholder="请输入账号名" />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "请输入正确的邮箱地址" }]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: "请选择角色" }]}
          >
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item label="启用状态" name="is_active" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
