import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Drawer, Empty, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  fetchAdminProjectDetail,
  fetchAdminSingleTurnSearchCaseRecordDetail,
  fetchAdminSingleTurnSearchCaseRecords,
} from "../../services/api";
import type {
  ProjectItem,
  SingleTurnSearchCaseSubmissionDetail,
  SingleTurnSearchCaseSubmissionSummary,
} from "../../types/api";

export function SingleTurnSearchCaseResultsPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const projectIdNumber = useMemo(() => Number(projectId), [projectId]);
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [items, setItems] = useState<SingleTurnSearchCaseSubmissionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SingleTurnSearchCaseSubmissionDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadPageData = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      setLoadError("项目参数不正确");
      return;
    }

    setLoading(true);
    try {
      const [projectDetail, records] = await Promise.all([
        fetchAdminProjectDetail(projectIdNumber),
        fetchAdminSingleTurnSearchCaseRecords(projectIdNumber),
      ]);
      setProject(projectDetail);
      setItems(Array.isArray(records) ? records : []);
      setLoadError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取提交结果失败";
      setLoadError(errorMessage);
      if (!silent) {
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData({ silent: true });
  }, [projectIdNumber]);

  const openDetail = async (submissionId: number) => {
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      return;
    }
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const data = await fetchAdminSingleTurnSearchCaseRecordDetail(projectIdNumber, submissionId);
      setDetail(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "获取提交详情失败";
      message.error(errorMessage);
      setDetail(null);
    } finally {
      setDetailLoading(false);
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
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/admin/projects/${projectIdNumber}/tasks`)}>
              返回模板管理
            </Button>
          </Space>
        }
      >
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {project ? `${project.name} / 提交结果` : "提交结果"}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          这里展示专家用户提交的完整搜索 case，包括题目、双模型回复、评分规则、逐条评分与自动计算结果。
        </Typography.Paragraph>
      </Card>

      {loadError ? <Alert type="warning" showIcon message="获取提交结果失败" description={loadError} /> : null}

      <Card className="panel-card" title="结果列表">
        <Table<SingleTurnSearchCaseSubmissionSummary>
          rowKey="submission_id"
          loading={loading}
          dataSource={Array.isArray(items) ? items : []}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无提交结果" /> }}
          columns={[
            {
              title: "提交人",
              dataIndex: "annotator_id",
              width: 120,
              render: (value: number | null) => value ?? "-",
            },
            {
              title: "题目领域",
              dataIndex: "domain",
              width: 140,
            },
            {
              title: "Prompt 摘要",
              dataIndex: "prompt",
              render: (value: string) => (
                <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, expandable: true }}>
                  {value}
                </Typography.Paragraph>
              ),
            },
            {
              title: "时效性",
              dataIndex: "timeliness_tag",
              width: 120,
            },
            {
              title: "规则信息",
              width: 140,
              render: (_, record) => (
                <Space direction="vertical" size={4}>
                  <Typography.Text>{`规则 ${record.rule_count}`}</Typography.Text>
                  <Typography.Text type="secondary">{`扣分项 ${record.penalty_rule_count}`}</Typography.Text>
                </Space>
              ),
            },
            {
              title: "模型一",
              width: 140,
              render: (_, record) => `${record.model_a_raw_score} / ${record.model_a_percentage}%`,
            },
            {
              title: "模型二",
              width: 140,
              render: (_, record) => `${record.model_b_raw_score} / ${record.model_b_percentage}%`,
            },
            {
              title: "分差",
              dataIndex: "score_gap",
              width: 100,
              render: (value: number) => `${value}%`,
            },
            {
              title: "状态",
              dataIndex: "status",
              width: 100,
              render: (value: string) => <Tag color="blue">{value}</Tag>,
            },
            {
              title: "提交时间",
              dataIndex: "submitted_at",
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: "操作",
              width: 100,
              render: (_, record) => (
                <Button type="link" onClick={() => void openDetail(record.submission_id)}>
                  查看详情
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Drawer title="提交详情" width={960} open={detailOpen} onClose={() => setDetailOpen(false)} loading={detailLoading}>
        {detail ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="任务 ID">{detail.task_id}</Descriptions.Item>
              <Descriptions.Item label="用户 ID">{detail.annotator_id ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="题目领域">{detail.domain}</Descriptions.Item>
              <Descriptions.Item label="时效性标签">{detail.timeliness_tag}</Descriptions.Item>
              <Descriptions.Item label="规则数量">{detail.rule_count}</Descriptions.Item>
              <Descriptions.Item label="扣分项数量">{detail.penalty_rule_count}</Descriptions.Item>
              <Descriptions.Item label="模型一得分">{`${detail.model_a_raw_score} / ${detail.model_a_percentage}%`}</Descriptions.Item>
              <Descriptions.Item label="模型二得分">{`${detail.model_b_raw_score} / ${detail.model_b_percentage}%`}</Descriptions.Item>
              <Descriptions.Item label="分差">{`${detail.score_gap}%`}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{new Date(detail.submitted_at).toLocaleString()}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="场景说明">
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{detail.scenario_description}</Typography.Paragraph>
            </Card>

            <Card size="small" title="Prompt">
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{detail.prompt}</Typography.Paragraph>
            </Card>

            <Card size="small" title={detail.model_a.model_name}>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{detail.model_a.response_text}</Typography.Paragraph>
                <Typography.Text>{`分享链接：${detail.model_a.share_link}`}</Typography.Text>
                {detail.model_a.screenshot ? <img src={detail.model_a.screenshot} alt="model-a" style={{ maxWidth: "100%", borderRadius: 12 }} /> : null}
              </Space>
            </Card>

            <Card size="small" title={detail.model_b.model_name}>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{detail.model_b.response_text}</Typography.Paragraph>
                <Typography.Text>{`分享链接：${detail.model_b.share_link}`}</Typography.Text>
                {detail.model_b.screenshot ? <img src={detail.model_b.screenshot} alt="model-b" style={{ maxWidth: "100%", borderRadius: 12 }} /> : null}
              </Space>
            </Card>

            <Card size="small" title="参考答案">
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{detail.reference_answer}</Typography.Paragraph>
            </Card>

            <Card size="small" title="评分规则与判定">
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {detail.scoring_rules.map((rule, index) => (
                  <Card key={`${detail.submission_id}-${index}`} type="inner" title={`规则 ${index + 1}`}>
                    <Space direction="vertical" size={6} style={{ width: "100%" }}>
                      <Typography.Text>{`分类：${rule.rule_category}`}</Typography.Text>
                      <Typography.Text>{`权重：${rule.weight}`}</Typography.Text>
                      <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                        {rule.rule_text}
                      </Typography.Paragraph>
                      <Typography.Text type="secondary">{`证据来源：${rule.evidence_source_type}`}</Typography.Text>
                      <Typography.Text type="secondary">{`引用说明：${rule.quote_text || "-"}`}</Typography.Text>
                      <Typography.Text type="secondary">{`模型一：${detail.model_a_evaluations[index]?.hit ? "Yes" : "No"} / ${detail.model_a_evaluations[index]?.note || "-"}`}</Typography.Text>
                      <Typography.Text type="secondary">{`模型二：${detail.model_b_evaluations[index]?.hit ? "Yes" : "No"} / ${detail.model_b_evaluations[index]?.note || "-"}`}</Typography.Text>
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>

            <Card size="small" title="自动统计与软提示">
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Typography.Text>{`正分总分：${detail.score_summary.positive_total_score}`}</Typography.Text>
                <Typography.Text>{`模型一：${detail.score_summary.model_a_raw_score} / ${detail.score_summary.model_a_percentage}%`}</Typography.Text>
                <Typography.Text>{`模型二：${detail.score_summary.model_b_raw_score} / ${detail.score_summary.model_b_percentage}%`}</Typography.Text>
                <Typography.Text>{`分差：${detail.score_summary.score_gap}%`}</Typography.Text>
                <Typography.Text>{detail.score_summary.model_a_below_target ? "模型一低于 50%" : "模型一达到 50%"}</Typography.Text>
                <Typography.Text>{detail.score_summary.score_gap_exceeds_target ? "两模型分差超过 15%" : "两模型分差在阈值内"}</Typography.Text>
                {detail.soft_checks.length > 0 ? (
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    {detail.soft_checks.map((item) => (
                      <Alert key={item.code} type={item.level === "warning" ? "warning" : "info"} showIcon message={item.message} />
                    ))}
                  </Space>
                ) : null}
              </Space>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
