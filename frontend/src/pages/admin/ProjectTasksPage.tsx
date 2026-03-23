import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EyeOutlined,
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
  createAdminProjectTask,
  fetchAdminProjectDetail,
  fetchAdminProjectTaskSubmissions,
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
  ModelResponseReviewSubmissionRecord,
  ModelResponseReviewTaskTemplatePayload,
  ProjectItem,
  SingleTurnSearchCaseSchema,
  SingleTurnSearchCaseSubmissionSummary,
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
  sections: [
    "Task Overview",
    "Task Category",
    "Prompt",
    "Model Response",
    "Review Rubric",
    "Answer Rating",
    "Rating Rationale",
  ],
  task_category_options: [
    "Academic Writing",
    "Summarization",
    "Question Answering",
    "Translation",
    "Code Explanation",
    "Content Moderation",
    "Style Rewriting",
    "Other",
  ],
  answer_rating_options: ["Gold Response", "Good Response", "Average Response", "Poor Response"],
  rating_reason_placeholder: "Explain the main reason for your rating.",
};

const DEFAULT_SEARCH_CASE_SCHEMA: SingleTurnSearchCaseSchema = {
  plugin_code: "single_turn_search_case",
  plugin_version: "1.0.0",
  page_title: "Single Turn Search Boundary Case",
  sections: [
    "作业说明区",
    "出题信息区",
    "模型一回复录入区",
    "模型二回复录入区",
    "参考答案区",
    "评分规则区",
    "模型评分区",
    "自动统计区",
  ],
  evidence_source_options: ["web_link", "prompt_requirement", "project_document", "none"],
  default_domain_options: ["本地生活", "旅游出行", "消费决策", "教育培训", "健康信息", "科技数码", "工作效率", "其他"],
  default_timeliness_options: ["弱时效", "中时效", "强时效"],
  model_labels: ["模型一", "模型二"],
};

function getPublishStatusText(status: string): string {
  if (status === "published") return "已发布";
  if (status === "offline") return "已下线";
  return status;
}

function getTaskStatusText(status: string): string {
  if (status === "pending") return "待完成";
  if (status === "completed") return "已完成";
  return status;
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
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionItems, setSubmissionItems] = useState<ModelResponseReviewSubmissionRecord[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<ModelResponseReviewSubmissionRecord | null>(null);
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
    setSubmissionItems([]);
    setSelectedSubmission(null);
    setSubmissionModalOpen(false);
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
      if (requestId !== requestIdRef.current) {
        return;
      }

      setProject(projectDetail);
      if (projectDetail.plugin_code === "single_turn_search_case") {
        setMrrSchema(null);
        setSearchCaseSchema(DEFAULT_SEARCH_CASE_SCHEMA);
      } else if (projectDetail.plugin_code === "model_response_review") {
        setSearchCaseSchema(null);
        setMrrSchema(DEFAULT_MRR_SCHEMA);
      } else {
        setSearchCaseSchema(null);
        setMrrSchema(null);
      }

      const taskList = await fetchAdminProjectTasks(projectIdNumber);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setItems(Array.isArray(taskList) ? taskList : []);

      if (projectDetail.plugin_code === "single_turn_search_case") {
        try {
          const pluginSchema = await fetchSingleTurnSearchCaseSchema();
          if (requestId !== requestIdRef.current) {
            return;
          }
          setSearchCaseSchema(pluginSchema);
        } catch {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setSearchCaseSchema(DEFAULT_SEARCH_CASE_SCHEMA);
        }
      } else if (projectDetail.plugin_code === "model_response_review") {
        try {
          const pluginSchema = await fetchModelResponseReviewSchema();
          if (requestId !== requestIdRef.current) {
            return;
          }
          setMrrSchema(pluginSchema);
        } catch {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setMrrSchema(DEFAULT_MRR_SCHEMA);
        }
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "获取项目任务失败，请稍后重试";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(errorMessage);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
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
    if (!project) {
      message.warning("项目信息尚未加载完成，请稍后再试");
      return;
    }
    if (!isSupportedProject) {
      message.warning("当前项目暂不支持在此页面创建任务");
      return;
    }
    modelResponseForm.resetFields();
    searchCaseForm.resetFields();
    modelResponseForm.setFieldsValue({ rubric_version: "v1", metadata_json: "" });
    searchCaseForm.setFieldsValue({
      require_model_screenshot: true,
      require_share_link: true,
      scoring_rules_min: 5,
      scoring_rules_max: 20,
      min_penalty_rules: 2,
      timeliness_options: ["弱时效", "中时效", "强时效"],
      domain_options: searchCaseSchema?.default_domain_options || ["本地生活", "旅游出行", "消费决策", "教育培训", "健康信息", "科技数码", "工作效率", "其他"],
      show_case_guidance: true,
      model_a_name: "模型一",
      model_b_name: "模型二",
    });
    searchCaseForm.setFieldsValue({
      timeliness_options: searchCaseSchema?.default_timeliness_options || DEFAULT_SEARCH_CASE_SCHEMA.default_timeliness_options,
      domain_options: searchCaseSchema?.default_domain_options || DEFAULT_SEARCH_CASE_SCHEMA.default_domain_options,
      model_a_name: DEFAULT_SEARCH_CASE_SCHEMA.model_labels[0],
      model_b_name: DEFAULT_SEARCH_CASE_SCHEMA.model_labels[1],
    });
    setModalOpen(true);
  };

  const handleCreateModelResponseTask = async (values: ModelResponseReviewTaskFormValues) => {
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      message.error("项目参数不正确");
      return;
    }

    let metadata: Record<string, unknown> | undefined;
    if ((values.metadata_json || "").trim()) {
      try {
        const parsed = JSON.parse(values.metadata_json || "{}") as unknown;
        metadata = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
      } catch {
        message.error("Metadata 必须是合法的 JSON 对象");
        return;
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
      message.success("任务已创建");
      setModalOpen(false);
      await loadPageData({ silent: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建任务失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSearchCaseTask = async (values: SearchCaseTaskFormValues) => {
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      message.error("项目参数不正确");
      return;
    }

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
      message.success("模板已创建");
      setModalOpen(false);
      await loadPageData({ silent: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建模板失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishToggle = async (task: AdminProjectTaskItem) => {
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      message.error("项目参数不正确");
      return;
    }
    setPublishingId(task.id);
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
      message.error(error instanceof Error ? error.message : "更新任务状态失败");
    } finally {
      setPublishingId(null);
    }
  };

  const openSubmissionModal = async (task: AdminProjectTaskItem) => {
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      return;
    }
    setSubmissionModalOpen(true);
    setSelectedSubmission(null);
    setSubmissionLoading(true);
    try {
      const records = await fetchAdminProjectTaskSubmissions(projectIdNumber, task.id);
      setSubmissionItems((records as ModelResponseReviewSubmissionRecord[]) || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "获取提交记录失败");
      setSubmissionItems([]);
    } finally {
      setSubmissionLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Card
        className="panel-card"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadPageData()} loading={loading}>
              刷新
            </Button>
            {isSearchCase ? (
              <Button
                icon={<FileSearchOutlined />}
                disabled={!project}
                onClick={() => navigate(`/admin/projects/${projectIdNumber}/search-case-results`)}
              >
                查看提交结果
              </Button>
            ) : null}
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} disabled={!project || !isSupportedProject || loading}>
              {isSearchCase ? "新建模板" : "新建任务"}
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/projects")}>
            返回项目管理
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {project ? `${project.name} / ${isSearchCase ? "模板管理" : "任务管理"}` : "任务管理"}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {isSearchCase
              ? "这里管理单轮搜索 case 生产任务的模板配置。管理员发布的是模板，不预设具体题目；完整 case 由专家用户在提交页中产出。"
              : "这里维护当前项目下的标注任务。管理员可以手工新增测试任务，并控制任务的发布与下线。"}
          </Typography.Paragraph>
        </Space>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取项目任务失败" description={loadError} /> : null}

      <Card title={isSearchCase ? "模板列表" : "任务列表"} className="panel-card">
        <Table<AdminProjectTaskItem>
          rowKey="id"
          dataSource={Array.isArray(items) ? items : []}
          loading={loading}
          pagination={false}
          locale={{ emptyText: isSearchCase ? "暂无模板，可继续新建模板" : "暂无任务，可继续新建任务" }}
          columns={
            isSearchCase
              ? [
                  {
                    title: "模板名称",
                    render: (_, record) => getSearchCasePayload(record.task_payload).task_name,
                  },
                  {
                    title: "模板说明",
                    render: (_, record) => (
                      <Typography.Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ marginBottom: 0 }}>
                        {getSearchCasePayload(record.task_payload).task_description || "暂无说明"}
                      </Typography.Paragraph>
                    ),
                  },
                  {
                    title: "模板配置",
                    width: 220,
                    render: (_, record) => {
                      const payload = getSearchCasePayload(record.task_payload);
                      return (
                        <Space direction="vertical" size={4}>
                          <Typography.Text>{`规则 ${payload.scoring_rules_min}-${payload.scoring_rules_max}`}</Typography.Text>
                          <Typography.Text type="secondary">{`扣分项最少 ${payload.min_penalty_rules}`}</Typography.Text>
                          <Typography.Text type="secondary">{`领域 ${payload.domain_options.length} / 时效 ${payload.timeliness_options.length}`}</Typography.Text>
                        </Space>
                      );
                    },
                  },
                  {
                    title: "任务状态",
                    width: 120,
                    render: (_, record) => (
                      <Tag color={record.task_status === "completed" ? "blue" : "gold"}>{getTaskStatusText(record.task_status)}</Tag>
                    ),
                  },
                  {
                    title: "发布状态",
                    width: 160,
                    render: (_, record) => (
                      <Space direction="vertical" size={4}>
                        <Tag color={record.publish_status === "published" ? "green" : "default"}>
                          {getPublishStatusText(record.publish_status)}
                        </Tag>
                        <Typography.Text type="secondary">用户可见：{record.is_visible ? "是" : "否"}</Typography.Text>
                      </Space>
                    ),
                  },
                  {
                    title: "操作",
                    width: 120,
                    render: (_, record) => (
                      <Button
                        type={record.publish_status === "published" ? "default" : "primary"}
                        icon={record.publish_status === "published" ? <StopOutlined /> : <CheckCircleOutlined />}
                        loading={publishingId === record.id}
                        onClick={() => void handlePublishToggle(record)}
                      >
                        {record.publish_status === "published" ? "下线" : "发布"}
                      </Button>
                    ),
                  },
                ]
              : [
                  {
                    title: "任务标识",
                    dataIndex: "external_task_id",
                    width: 190,
                  },
                  {
                    title: "任务类型",
                    width: 160,
                    render: (_, record) => getModelResponsePayload(record.task_payload).task_category || "Other",
                  },
                  {
                    title: "Prompt",
                    render: (_, record) => (
                      <Typography.Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ marginBottom: 0 }}>
                        {getModelResponsePayload(record.task_payload).prompt}
                      </Typography.Paragraph>
                    ),
                  },
                  {
                    title: "模型回答",
                    width: 140,
                    render: (_, record) => (
                      <Tag color={getModelResponsePayload(record.task_payload).model_reply ? "blue" : "default"}>
                        {getModelResponsePayload(record.task_payload).model_reply ? "已提供" : "待生成"}
                      </Tag>
                    ),
                  },
                  {
                    title: "发布状态",
                    width: 160,
                    render: (_, record) => (
                      <Space direction="vertical" size={4}>
                        <Tag color={record.publish_status === "published" ? "green" : "default"}>
                          {getPublishStatusText(record.publish_status)}
                        </Tag>
                        <Typography.Text type="secondary">用户可见：{record.is_visible ? "是" : "否"}</Typography.Text>
                      </Space>
                    ),
                  },
                  {
                    title: "任务状态",
                    width: 120,
                    render: (_, record) => (
                      <Tag color={record.task_status === "completed" ? "blue" : "gold"}>{getTaskStatusText(record.task_status)}</Tag>
                    ),
                  },
                  {
                    title: "发布时间",
                    width: 180,
                    render: (_, record) => (record.published_at ? new Date(record.published_at).toLocaleString() : "-"),
                  },
                  {
                    title: "操作",
                    width: 220,
                    render: (_, record) => (
                      <Space wrap>
                        <Button
                          type={record.publish_status === "published" ? "default" : "primary"}
                          icon={record.publish_status === "published" ? <StopOutlined /> : <CheckCircleOutlined />}
                          loading={publishingId === record.id}
                          onClick={() => void handlePublishToggle(record)}
                        >
                          {record.publish_status === "published" ? "下线" : "发布"}
                        </Button>
                        <Button icon={<EyeOutlined />} onClick={() => void openSubmissionModal(record)}>
                          查看提交
                        </Button>
                      </Space>
                    ),
                  },
                ]
          }
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
              <Col xs={24} md={12}>
                <Form.Item label="模板标识" name="external_task_id">
                  <Input placeholder="可选，留空则自动生成" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="模板名称" name="task_name" rules={[{ required: true, message: "请输入模板名称" }]}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="模板说明" name="task_description">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item label="作业指引文案" name="instruction_text">
              <Input.TextArea rows={4} />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="规则最少条数" name="scoring_rules_min" rules={[{ required: true, message: "请输入最少条数" }]}>
                  <InputNumber min={5} max={20} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="规则最多条数" name="scoring_rules_max" rules={[{ required: true, message: "请输入最多条数" }]}>
                  <InputNumber min={5} max={20} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="最少扣分项" name="min_penalty_rules" rules={[{ required: true, message: "请输入最少扣分项" }]}>
                  <InputNumber min={1} max={10} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="支持的时效性标签" name="timeliness_options" rules={[{ required: true, message: "请输入时效性标签" }]}>
                  <Select mode="tags" tokenSeparators={[","]} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="支持的领域选项" name="domain_options" rules={[{ required: true, message: "请输入领域选项" }]}>
                  <Select mode="tags" tokenSeparators={[","]} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="模型一名称" name="model_a_name" rules={[{ required: true, message: "请输入模型一名称" }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="模型二名称" name="model_b_name" rules={[{ required: true, message: "请输入模型二名称" }]}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="要求截图" name="require_model_screenshot" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="要求分享链接" name="require_share_link" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="显示 goodcase/badcase 提示" name="show_case_guidance" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        ) : (
          <Form form={modelResponseForm} layout="vertical" onFinish={handleCreateModelResponseTask}>
            <Form.Item label="任务标识" name="external_task_id">
              <Input placeholder="可选，留空则自动生成" />
            </Form.Item>
            <Form.Item label="任务类型" name="task_category">
              <Select
                allowClear
                options={(mrrSchema?.task_category_options ?? []).map((item) => ({ label: item, value: item }))}
                placeholder="可选，不填时默认 Other"
              />
            </Form.Item>
            <Form.Item label="Prompt" name="prompt" rules={[{ required: true, message: "请输入 Prompt" }]}>
              <Input.TextArea rows={5} placeholder="请输入任务 Prompt" />
            </Form.Item>
            <Form.Item label="Model Response" name="model_reply">
              <Input.TextArea rows={5} placeholder="可选，可先留空，后续在用户端生成模型回答" />
            </Form.Item>
            <Form.Item label="Rubric Version" name="rubric_version">
              <Input placeholder="可选，默认 v1" />
            </Form.Item>
            <Form.Item label="Metadata JSON" name="metadata_json">
              <Input.TextArea rows={4} placeholder='可选，例如 {"difficulty":"easy","language":"en"}' />
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="提交记录"
        open={submissionModalOpen}
        onCancel={() => {
          setSubmissionModalOpen(false);
          setSelectedSubmission(null);
        }}
        footer={null}
        width={960}
        destroyOnHidden
      >
        <Table<ModelResponseReviewSubmissionRecord>
          rowKey="submission_id"
          loading={submissionLoading}
          dataSource={Array.isArray(submissionItems) ? submissionItems : []}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无提交记录" /> }}
          columns={[
            {
              title: "提交时间",
              dataIndex: "submitted_at",
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: "标注员 ID",
              dataIndex: "annotator_id",
              width: 120,
              render: (value: number | null) => value ?? "-",
            },
            {
              title: "评分",
              dataIndex: "answer_rating",
              width: 160,
            },
            {
              title: "评审理由",
              dataIndex: "rating_reason",
              render: (value: string) => (
                <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, expandable: true }}>
                  {value}
                </Typography.Paragraph>
              ),
            },
            {
              title: "操作",
              width: 120,
              render: (_, record) => (
                <Button type="link" onClick={() => setSelectedSubmission(record)}>
                  查看详情
                </Button>
              ),
            },
          ]}
        />
      </Modal>

      <Drawer title="提交详情" width={720} open={Boolean(selectedSubmission)} onClose={() => setSelectedSubmission(null)}>
        {selectedSubmission ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="任务 ID">{selectedSubmission.task_id}</Descriptions.Item>
              <Descriptions.Item label="标注员 ID">{selectedSubmission.annotator_id ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="任务类型">{selectedSubmission.task_category}</Descriptions.Item>
              <Descriptions.Item label="评分">{selectedSubmission.answer_rating}</Descriptions.Item>
              <Descriptions.Item label="Rubric 版本">{selectedSubmission.rubric_version}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{new Date(selectedSubmission.submitted_at).toLocaleString()}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="评审理由">
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{selectedSubmission.rating_reason}</Typography.Paragraph>
            </Card>
            <Card size="small" title="Prompt Snapshot">
              <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                {selectedSubmission.prompt_snapshot}
              </Typography.Paragraph>
            </Card>
            <Card size="small" title="Model Reply Snapshot">
              <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                {selectedSubmission.model_reply_snapshot}
              </Typography.Paragraph>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
