import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  approveAdminProjectTask,
  createAdminProjectTask,
  deleteAdminProjectTask,
  dispatchAdminProjectTaskReview,
  fetchAdminProjectDetail,
  fetchAdminProjectTaskReviews,
  fetchAdminProjectTasks,
  fetchModelResponseReviewSchema,
  fetchSingleTurnSearchCaseSchema,
  publishAdminProjectTask,
  unpublishAdminProjectTask,
} from "../../services/api";
import type {
  AdminProjectTaskCreatePayload,
  AdminProjectTaskItem,
  ModelResponseReviewSchema,
  ModelResponseReviewTaskTemplatePayload,
  ProjectItem,
  ProjectTaskReviewItem,
  SingleTurnSearchCaseSchema,
  SingleTurnSearchCaseTaskTemplatePayload,
} from "../../types/api";

interface ModelResponseReviewTaskFormValues {
  external_task_id?: string;
  task_category?: string;
  prompt: string;
  model_reply?: string;
  rubric_version?: string;
  metadata_json?: string;
}

interface SearchCaseTaskFormValues {
  external_task_id?: string;
  task_name: string;
  task_description?: string;
  instruction_text?: string;
  require_model_screenshot: boolean;
  require_share_link: boolean;
  scoring_rules_min: number;
  scoring_rules_max: number;
  min_penalty_rules: number;
  timeliness_options: string[];
  domain_options: string[];
  show_case_guidance: boolean;
  model_a_name: string;
  model_b_name: string;
}

const DEFAULT_MRR_SCHEMA: ModelResponseReviewSchema = {
  plugin_code: "model_response_review",
  plugin_version: "1.0.0",
  page_title: "Model Response Review",
  sections: ["Task Overview", "Task Category", "Prompt", "Model Response", "Review Rubric", "Answer Rating", "Rating Rationale"],
  task_category_options: ["Academic Writing", "Summarization", "Question Answering", "Translation", "Code Explanation", "Content Moderation", "Style Rewriting", "Other"],
  answer_rating_options: ["Gold Response", "Good Response", "Average Response", "Poor Response"],
  rating_reason_placeholder: "Explain the main reason for your rating.",
};

const DEFAULT_SEARCH_CASE_SCHEMA: SingleTurnSearchCaseSchema = {
  plugin_code: "single_turn_search_case",
  plugin_version: "1.0.0",
  page_title: "Single Turn Search Boundary Case",
  sections: ["作业说明区", "出题信息区", "模型一回复录入区", "模型二回复录入区", "参考答案区", "评分规则区", "模型评分区", "自动统计区"],
  evidence_source_options: ["web_link", "prompt_requirement", "project_document", "none"],
  default_domain_options: ["本地生活", "旅游出行", "消费决策", "教育培训", "健康信息", "科技数码", "工作效率", "其他"],
  default_timeliness_options: ["弱时效", "中时效", "强时效"],
  model_labels: ["模型一", "模型二"],
};

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "-";
}

function getPublishMeta(status: string) {
  if (status === "published") return { color: "green", label: "已发布" };
  if (status === "offline") return { color: "default", label: "已下线" };
  return { color: "default", label: status };
}

function getTaskMeta(status: string) {
  switch (status) {
    case "annotation_pending":
      return { color: "default", label: "待领取试标" };
    case "annotation_in_progress":
      return { color: "blue", label: "试标中" };
    case "pending_review_dispatch":
      return { color: "orange", label: "待发起质检" };
    case "review_pending":
      return { color: "gold", label: "待领取质检" };
    case "review_in_progress":
      return { color: "cyan", label: "质检中" };
    case "review_submitted":
      return { color: "purple", label: "待管理员处理" };
    case "approved":
      return { color: "green", label: "已通过" };
    default:
      return { color: "default", label: status };
  }
}

function getReviewMeta(status: string | null | undefined) {
  if (status === "pending") return { color: "gold", label: "待领取" };
  if (status === "in_progress") return { color: "blue", label: "质检中" };
  if (status === "submitted") return { color: "green", label: "已提交" };
  return status ? { color: "default", label: status } : null;
}

function formatUserText(username: string | null | undefined, userId: number | null | undefined) {
  if (username && userId) return `${username} (#${userId})`;
  if (username) return username;
  if (userId) return `#${userId}`;
  return "-";
}

function canDispatchReview(task: AdminProjectTaskItem) {
  return task.task_status === "review_submitted";
}

function canApproveTask(task: AdminProjectTaskItem) {
  return task.task_status === "review_submitted";
}

function getModelResponsePayload(payload: Record<string, unknown>): ModelResponseReviewTaskTemplatePayload {
  return {
    prompt: String(payload.prompt || ""),
    model_reply: payload.model_reply ? String(payload.model_reply) : null,
    task_category: String(payload.task_category || "Other"),
    metadata: (payload.metadata as Record<string, unknown>) || {},
    rubric_version: String(payload.rubric_version || "v1"),
  };
}

function getSearchCasePayload(payload: Record<string, unknown>): SingleTurnSearchCaseTaskTemplatePayload {
  return {
    task_name: String(payload.task_name || ""),
    task_description: payload.task_description ? String(payload.task_description) : null,
    instruction_text: payload.instruction_text ? String(payload.instruction_text) : null,
    require_model_screenshot: Boolean(payload.require_model_screenshot ?? true),
    require_share_link: Boolean(payload.require_share_link ?? true),
    scoring_rules_min: Number(payload.scoring_rules_min ?? 5),
    scoring_rules_max: Number(payload.scoring_rules_max ?? 20),
    min_penalty_rules: Number(payload.min_penalty_rules ?? 2),
    timeliness_options: Array.isArray(payload.timeliness_options) ? (payload.timeliness_options as string[]) : [],
    domain_options: Array.isArray(payload.domain_options) ? (payload.domain_options as string[]) : [],
    show_case_guidance: Boolean(payload.show_case_guidance ?? true),
    model_a_name: String(payload.model_a_name || "模型一"),
    model_b_name: String(payload.model_b_name || "模型二"),
  };
}

export function ProjectTasksPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const projectIdNumber = useMemo(() => Number(projectId), [projectId]);
  const [modelResponseForm] = Form.useForm<ModelResponseReviewTaskFormValues>();
  const [searchCaseForm] = Form.useForm<SearchCaseTaskFormValues>();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [mrrSchema, setMrrSchema] = useState<ModelResponseReviewSchema | null>(null);
  const [searchCaseSchema, setSearchCaseSchema] = useState<SingleTurnSearchCaseSchema | null>(null);
  const [items, setItems] = useState<AdminProjectTaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [reviewDrawerTask, setReviewDrawerTask] = useState<AdminProjectTaskItem | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewItems, setReviewItems] = useState<ProjectTaskReviewItem[]>([]);
  const requestIdRef = useRef(0);

  const isModelResponseReview = project?.plugin_code === "model_response_review";
  const isSearchCase = project?.plugin_code === "single_turn_search_case";
  const isSupportedProject = isModelResponseReview || isSearchCase;

  const resetPageState = () => {
    setProject(null);
    setMrrSchema(null);
    setSearchCaseSchema(null);
    setItems([]);
    setLoadError(null);
    setReviewDrawerTask(null);
    setReviewItems([]);
    setReviewDrawerOpen(false);
    modelResponseForm.resetFields();
    searchCaseForm.resetFields();
  };

  const loadPageData = async ({ silent = false }: { silent?: boolean } = {}) => {
    const requestId = ++requestIdRef.current;
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      setLoadError("项目参数不正确");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const projectDetail = await fetchAdminProjectDetail(projectIdNumber);
      if (requestId !== requestIdRef.current) return;
      setProject(projectDetail);
      const taskList = await fetchAdminProjectTasks(projectIdNumber);
      if (requestId !== requestIdRef.current) return;
      setItems(Array.isArray(taskList) ? taskList : []);
      if (projectDetail.plugin_code === "single_turn_search_case") {
        setMrrSchema(null);
        setSearchCaseSchema(await fetchSingleTurnSearchCaseSchema().catch(() => DEFAULT_SEARCH_CASE_SCHEMA));
      } else if (projectDetail.plugin_code === "model_response_review") {
        setSearchCaseSchema(null);
        setMrrSchema(await fetchModelResponseReviewSchema().catch(() => DEFAULT_MRR_SCHEMA));
      } else {
        setMrrSchema(null);
        setSearchCaseSchema(null);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      const errorMessage = error instanceof Error ? error.message : "获取项目任务失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) message.error(errorMessage);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    resetPageState();
    void loadPageData({ silent: true });
    return () => {
      requestIdRef.current += 1;
    };
  }, [projectIdNumber]);

  const openCreateModal = () => {
    if (!project) return message.warning("项目详情还没有加载完成");
    if (!isSupportedProject) return message.warning("当前项目暂不支持在这里创建任务");
    modelResponseForm.resetFields();
    searchCaseForm.resetFields();
    modelResponseForm.setFieldsValue({ rubric_version: "v1", metadata_json: "" });
    searchCaseForm.setFieldsValue({
      require_model_screenshot: true,
      require_share_link: true,
      scoring_rules_min: 5,
      scoring_rules_max: 20,
      min_penalty_rules: 2,
      timeliness_options: searchCaseSchema?.default_timeliness_options || DEFAULT_SEARCH_CASE_SCHEMA.default_timeliness_options,
      domain_options: searchCaseSchema?.default_domain_options || DEFAULT_SEARCH_CASE_SCHEMA.default_domain_options,
      show_case_guidance: true,
      model_a_name: DEFAULT_SEARCH_CASE_SCHEMA.model_labels[0],
      model_b_name: DEFAULT_SEARCH_CASE_SCHEMA.model_labels[1],
    });
    setModalOpen(true);
  };

  const handleCreateModelResponseTask = async (values: ModelResponseReviewTaskFormValues) => {
    let metadata: Record<string, unknown> | undefined;
    if ((values.metadata_json || "").trim()) {
      try {
        const parsed = JSON.parse(values.metadata_json || "{}") as unknown;
        metadata = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
      } catch {
        return message.error("Metadata 必须是合法的 JSON 对象");
      }
    }
    const payload: AdminProjectTaskCreatePayload = {
      external_task_id: values.external_task_id?.trim() || null,
      task_payload: {
        prompt: values.prompt.trim(),
        model_reply: values.model_reply?.trim() || null,
        task_category: values.task_category?.trim() || null,
        metadata,
        rubric_version: values.rubric_version?.trim() || null,
      },
    };
    setSubmitting(true);
    try {
      await createAdminProjectTask(projectIdNumber, payload);
      setModalOpen(false);
      message.success("任务已创建");
      await loadPageData({ silent: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建任务失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSearchCaseTask = async (values: SearchCaseTaskFormValues) => {
    const payload: AdminProjectTaskCreatePayload = {
      external_task_id: values.external_task_id?.trim() || null,
      task_payload: {
        task_name: values.task_name.trim(),
        task_description: values.task_description?.trim() || null,
        instruction_text: values.instruction_text?.trim() || null,
        require_model_screenshot: values.require_model_screenshot,
        require_share_link: values.require_share_link,
        scoring_rules_min: values.scoring_rules_min,
        scoring_rules_max: values.scoring_rules_max,
        min_penalty_rules: values.min_penalty_rules,
        timeliness_options: values.timeliness_options,
        domain_options: values.domain_options,
        show_case_guidance: values.show_case_guidance,
        model_a_name: values.model_a_name.trim(),
        model_b_name: values.model_b_name.trim(),
      },
    };
    setSubmitting(true);
    try {
      await createAdminProjectTask(projectIdNumber, payload);
      setModalOpen(false);
      message.success("模板已创建");
      await loadPageData({ silent: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建模板失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishToggle = async (task: AdminProjectTaskItem) => {
    const key = `publish-${task.id}`;
    setActionKey(key);
    try {
      if (task.publish_status === "published") {
        await unpublishAdminProjectTask(projectIdNumber, task.id);
        message.success("任务已下线");
      } else {
        await publishAdminProjectTask(projectIdNumber, task.id);
        message.success("任务已发布");
      }
      await loadPageData({ silent: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新任务发布状态失败");
    } finally {
      setActionKey(null);
    }
  };

  const handleDispatchReview = async (task: AdminProjectTaskItem) => {
    const key = `dispatch-${task.id}`;
    setActionKey(key);
    try {
      await dispatchAdminProjectTaskReview(projectIdNumber, task.id);
      message.success("质检轮次已追加");
      await loadPageData({ silent: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "追加质检失败");
    } finally {
      setActionKey(null);
    }
  };

  const handleApproveTask = async (task: AdminProjectTaskItem) => {
    const key = `approve-${task.id}`;
    setActionKey(key);
    try {
      await approveAdminProjectTask(projectIdNumber, task.id);
      message.success("任务已通过");
      await loadPageData({ silent: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "任务通过失败");
    } finally {
      setActionKey(null);
    }
  };

  const handleDeleteTask = (task: AdminProjectTaskItem) => {
    Modal.confirm({
      title: "删除任务",
      content: `确认删除任务 ${task.external_task_id} 吗？已提交的试标和质检记录也会一起删除。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        const key = `delete-${task.id}`;
        setActionKey(key);
        try {
          await deleteAdminProjectTask(projectIdNumber, task.id);
          message.success("任务已删除");
          await loadPageData({ silent: true });
        } catch (error) {
          message.error(error instanceof Error ? error.message : "删除任务失败");
        } finally {
          setActionKey(null);
        }
      },
    });
  };

  const openReviewDrawer = async (task: AdminProjectTaskItem) => {
    setReviewDrawerTask(task);
    setReviewDrawerOpen(true);
    setReviewLoading(true);
    try {
      setReviewItems(await fetchAdminProjectTaskReviews(projectIdNumber, task.id));
    } catch (error) {
      setReviewItems([]);
      message.error(error instanceof Error ? error.message : "获取质检记录失败");
    } finally {
      setReviewLoading(false);
    }
  };

  const renderWorkflow = (record: AdminProjectTaskItem) => {
    const publishMeta = getPublishMeta(record.publish_status);
    const taskMeta = getTaskMeta(record.task_status);
    const latestReviewMeta = getReviewMeta(record.latest_review_status);
    return (
      <Space direction="vertical" size={4}>
        <Space wrap>
          <Tag color={publishMeta.color}>{publishMeta.label}</Tag>
          <Tag color={taskMeta.color}>{taskMeta.label}</Tag>
          {latestReviewMeta ? <Tag color={latestReviewMeta.color}>{`最新质检：${latestReviewMeta.label}`}</Tag> : null}
        </Space>
        <Typography.Text type="secondary">{`试标人：${formatUserText(record.annotation_assignee_username, record.annotation_assignee_id)}`}</Typography.Text>
        <Typography.Text type="secondary">{`试标提交：${formatDateTime(record.annotation_submitted_at)}`}</Typography.Text>
        <Typography.Text type="secondary">{`质检轮次：${record.review_round_count}`}</Typography.Text>
        {(record.latest_reviewer_id || record.latest_reviewer_username) ? (
          <Typography.Text type="secondary">{`最新质检人：${formatUserText(record.latest_reviewer_username, record.latest_reviewer_id)}`}</Typography.Text>
        ) : null}
      </Space>
    );
  };

  const renderActions = (record: AdminProjectTaskItem) => (
    <Space wrap>
      <Button
        type={record.publish_status === "published" ? "default" : "primary"}
        icon={record.publish_status === "published" ? <StopOutlined /> : <CheckCircleOutlined />}
        loading={actionKey === `publish-${record.id}`}
        onClick={() => void handlePublishToggle(record)}
      >
        {record.publish_status === "published" ? "下线" : "发布"}
      </Button>
      <Button disabled={!canDispatchReview(record)} loading={actionKey === `dispatch-${record.id}`} onClick={() => void handleDispatchReview(record)}>
        追加质检
      </Button>
      <Button disabled={!canApproveTask(record)} loading={actionKey === `approve-${record.id}`} onClick={() => void handleApproveTask(record)}>
        质检通过
      </Button>
      <Button disabled={record.review_round_count === 0} onClick={() => void openReviewDrawer(record)}>
        查看质检
      </Button>
      <Button danger loading={actionKey === `delete-${record.id}`} onClick={() => handleDeleteTask(record)}>
        删除
      </Button>
    </Space>
  );

  const columns = isSearchCase
    ? [
        { title: "模板名称", render: (_: unknown, record: AdminProjectTaskItem) => getSearchCasePayload(record.task_payload).task_name },
        {
          title: "模板说明",
          render: (_: unknown, record: AdminProjectTaskItem) => (
            <Typography.Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ marginBottom: 0 }}>
              {getSearchCasePayload(record.task_payload).task_description || "暂无说明"}
            </Typography.Paragraph>
          ),
        },
        {
          title: "模板配置",
          width: 220,
          render: (_: unknown, record: AdminProjectTaskItem) => {
            const payload = getSearchCasePayload(record.task_payload);
            return (
              <Space direction="vertical" size={4}>
                <Typography.Text>{`规则 ${payload.scoring_rules_min}-${payload.scoring_rules_max}`}</Typography.Text>
                <Typography.Text type="secondary">{`至少扣分项 ${payload.min_penalty_rules}`}</Typography.Text>
                <Typography.Text type="secondary">{`领域 ${payload.domain_options.length} / 时效 ${payload.timeliness_options.length}`}</Typography.Text>
              </Space>
            );
          },
        },
        { title: "流转信息", width: 260, render: (_: unknown, record: AdminProjectTaskItem) => renderWorkflow(record) },
        { title: "发布时间", width: 180, render: (_: unknown, record: AdminProjectTaskItem) => formatDateTime(record.published_at) },
        { title: "操作", width: 260, render: (_: unknown, record: AdminProjectTaskItem) => renderActions(record) },
      ]
    : [
        { title: "任务标识", dataIndex: "external_task_id", width: 180 },
        {
          title: "模型回复",
          width: 120,
          render: (_: unknown, record: AdminProjectTaskItem) => <Tag color={getModelResponsePayload(record.task_payload).model_reply ? "blue" : "default"}>{getModelResponsePayload(record.task_payload).model_reply ? "已生成" : "未生成"}</Tag>,
        },
        { title: "流转信息", width: 260, render: (_: unknown, record: AdminProjectTaskItem) => renderWorkflow(record) },
        { title: "发布时间", width: 180, render: (_: unknown, record: AdminProjectTaskItem) => formatDateTime(record.published_at) },
        { title: "操作", width: 360, render: (_: unknown, record: AdminProjectTaskItem) => renderActions(record) },
      ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Card
        className="panel-card"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadPageData()} loading={loading}>刷新</Button>
            {isSearchCase ? <Button icon={<FileSearchOutlined />} disabled={!project} onClick={() => navigate(`/admin/projects/${projectIdNumber}/search-case-results`)}>查看提交结果</Button> : null}
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} disabled={!project || !isSupportedProject || loading}>{isSearchCase ? "新建模板" : "新建任务"}</Button>
          </Space>
        }
      >
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/projects")}>返回项目管理</Button>
          <Typography.Title level={4} style={{ margin: 0 }}>{project ? `${project.name} / ${isSearchCase ? "模板管理" : "任务管理"}` : "任务管理"}</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {isSearchCase
              ? "这里管理搜索 Case 模板的发布和流转。用户先从共享任务池领取模板完成试标，提交后会自动进入质检队列，管理员只需要决定是否追加质检轮次或直接通过。"
              : "这里管理试标任务的发布和流转。用户领取的是共享任务池中的独占任务，试标提交后会自动进入质检队列，管理员只需要决定是否继续加轮或通过。"}
          </Typography.Paragraph>
        </Space>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取项目任务失败" description={loadError} /> : null}
      {!isSupportedProject && project ? <Alert type="info" showIcon message="当前项目插件暂不支持在此页面维护任务" /> : null}

      <Card title={isSearchCase ? "模板列表" : "任务列表"} className="panel-card">
        <Table<AdminProjectTaskItem>
          rowKey="id"
          dataSource={Array.isArray(items) ? items : []}
          loading={loading}
          pagination={false}
          scroll={{ x: 1200 }}
          locale={{ emptyText: isSearchCase ? "暂无模板，可继续新建模板" : "暂无任务，可继续新建任务" }}
          columns={columns}
        />
      </Card>

      <Modal
        title={isSearchCase ? "新建模板" : "新建任务"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => (isSearchCase ? searchCaseForm.submit() : modelResponseForm.submit())}
        confirmLoading={submitting}
        width={isSearchCase ? 880 : 640}
        destroyOnHidden
      >
        {isSearchCase ? (
          <Form form={searchCaseForm} layout="vertical" onFinish={handleCreateSearchCaseTask}>
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item label="模板标识" name="external_task_id"><Input placeholder="可选，留空则自动生成" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item label="模板名称" name="task_name" rules={[{ required: true, message: "请输入模板名称" }]}><Input /></Form.Item></Col>
            </Row>
            <Form.Item label="模板说明" name="task_description"><Input.TextArea rows={3} /></Form.Item>
            <Form.Item label="作业指引文案" name="instruction_text"><Input.TextArea rows={4} /></Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={8}><Form.Item label="规则最少条数" name="scoring_rules_min" rules={[{ required: true, message: "请输入规则最少条数" }]}><InputNumber min={5} max={20} style={{ width: "100%" }} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label="规则最多条数" name="scoring_rules_max" rules={[{ required: true, message: "请输入规则最多条数" }]}><InputNumber min={5} max={20} style={{ width: "100%" }} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label="最少扣分项" name="min_penalty_rules" rules={[{ required: true, message: "请输入最少扣分项" }]}><InputNumber min={1} max={10} style={{ width: "100%" }} /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item label="支持的时效标签" name="timeliness_options" rules={[{ required: true, message: "请输入时效标签" }]}><Select mode="tags" tokenSeparators={[","]} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item label="支持的领域选项" name="domain_options" rules={[{ required: true, message: "请输入领域选项" }]}><Select mode="tags" tokenSeparators={[","]} /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item label="模型一名称" name="model_a_name" rules={[{ required: true, message: "请输入模型一名称" }]}><Input /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item label="模型二名称" name="model_b_name" rules={[{ required: true, message: "请输入模型二名称" }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={8}><Form.Item label="要求截图" name="require_model_screenshot" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label="要求分享链接" name="require_share_link" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label="显示 goodcase/badcase 提示" name="show_case_guidance" valuePropName="checked"><Switch /></Form.Item></Col>
            </Row>
          </Form>
        ) : (
          <Form form={modelResponseForm} layout="vertical" onFinish={handleCreateModelResponseTask}>
            <Form.Item label="任务标识" name="external_task_id"><Input placeholder="可选，留空则自动生成" /></Form.Item>
            <Form.Item label="任务类型" name="task_category">
              <Select allowClear options={(mrrSchema?.task_category_options ?? []).map((item) => ({ label: item, value: item }))} placeholder="可选，不填时默认为 Other" />
            </Form.Item>
            <Form.Item label="Prompt" name="prompt" rules={[{ required: true, message: "请输入 Prompt" }]}><Input.TextArea rows={5} placeholder="请输入任务 Prompt" /></Form.Item>
            <Form.Item label="Model Response" name="model_reply"><Input.TextArea rows={5} placeholder="可选，可先留空，后续由用户端生成模型回复" /></Form.Item>
            <Form.Item label="Rubric Version" name="rubric_version"><Input placeholder="可选，默认 v1" /></Form.Item>
            <Form.Item label="Metadata JSON" name="metadata_json"><Input.TextArea rows={4} placeholder='可选，例如 {"difficulty":"easy","language":"en"}' /></Form.Item>
          </Form>
        )}
      </Modal>

      <Drawer title={reviewDrawerTask ? `质检记录 / ${reviewDrawerTask.external_task_id}` : "质检记录"} width={860} open={reviewDrawerOpen} onClose={() => { setReviewDrawerOpen(false); setReviewDrawerTask(null); setReviewItems([]); }}>
        {reviewDrawerTask ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="任务标识">{reviewDrawerTask.external_task_id}</Descriptions.Item>
              <Descriptions.Item label="当前阶段"><Tag color={getTaskMeta(reviewDrawerTask.task_status).color}>{getTaskMeta(reviewDrawerTask.task_status).label}</Tag></Descriptions.Item>
              <Descriptions.Item label="试标人">{formatUserText(reviewDrawerTask.annotation_assignee_username, reviewDrawerTask.annotation_assignee_id)}</Descriptions.Item>
              <Descriptions.Item label="试标提交时间">{formatDateTime(reviewDrawerTask.annotation_submitted_at)}</Descriptions.Item>
              <Descriptions.Item label="累计质检轮次">{reviewDrawerTask.review_round_count}</Descriptions.Item>
            </Descriptions>
            <Table<ProjectTaskReviewItem>
              rowKey="id"
              loading={reviewLoading}
              dataSource={reviewItems}
              pagination={false}
              locale={{ emptyText: "暂无质检记录" }}
              columns={[
                { title: "轮次", dataIndex: "review_round", width: 80 },
                { title: "质检人", width: 160, render: (_: unknown, record: ProjectTaskReviewItem) => formatUserText(record.reviewer_username, record.reviewer_id) },
                { title: "状态", width: 120, render: (_: unknown, record: ProjectTaskReviewItem) => { const meta = getReviewMeta(record.review_status); return meta ? <Tag color={meta.color}>{meta.label}</Tag> : "-"; } },
                { title: "结论", width: 120, render: (_: unknown, record: ProjectTaskReviewItem) => record.review_result || "-" },
                { title: "提交时间", width: 180, render: (_: unknown, record: ProjectTaskReviewItem) => formatDateTime(record.submitted_at) },
                { title: "备注", render: (_: unknown, record: ProjectTaskReviewItem) => <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 3, expandable: true }}>{record.review_comment || "-"}</Typography.Paragraph> },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
