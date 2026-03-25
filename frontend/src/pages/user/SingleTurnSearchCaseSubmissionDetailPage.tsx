import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Space, Spin, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  fetchSingleTurnSearchCaseMySubmissionDetail,
  fetchSingleTurnSearchCaseMySubmissionDetailById,
} from "../../services/api";
import type { SearchCaseRuleInput, SingleTurnSearchCaseSubmissionDetail } from "../../types/api";

export function SingleTurnSearchCaseSubmissionDetailPage() {
  const navigate = useNavigate();
  const { projectId, taskId, submissionId } = useParams<{
    projectId: string;
    taskId?: string;
    submissionId?: string;
  }>();
  const projectIdNumber = useMemo(() => Number(projectId), [projectId]);
  const taskIdValue = useMemo(() => taskId || "", [taskId]);
  const submissionIdNumber = useMemo(() => Number(submissionId), [submissionId]);
  const [detail, setDetail] = useState<SingleTurnSearchCaseSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadDetail = async ({ silent = false }: { silent?: boolean } = {}) => {
    const requestId = ++requestIdRef.current;
    if (Number.isNaN(projectIdNumber) || projectIdNumber <= 0) {
      setLoadError("项目参数不正确");
      return;
    }
    if (!taskIdValue && (!submissionId || Number.isNaN(submissionIdNumber) || submissionIdNumber <= 0)) {
      setLoadError("提交记录参数不正确");
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const result = taskIdValue
        ? await fetchSingleTurnSearchCaseMySubmissionDetail(projectIdNumber, taskIdValue)
        : await fetchSingleTurnSearchCaseMySubmissionDetailById(projectIdNumber, submissionIdNumber);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setDetail(result);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "加载提交详情失败，请稍后重试";
      setLoadError(errorMessage);
      setDetail(null);
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
    void loadDetail({ silent: true });
    return () => {
      requestIdRef.current += 1;
    };
  }, [projectIdNumber, taskIdValue, submissionIdNumber, submissionId]);

  return (
    <Spin spinning={loading}>
      <div className="search-case-page" style={{ padding: 24 }}>
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <Card className="search-case-card">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Space wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/user/annotation-tasks")}>
                  退出当前界面
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => void loadDetail()} loading={loading}>
                  刷新
                </Button>
              </Space>
              <div>
                <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                  Case 提交详情
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  这里展示你提交审核前的完整 Case 内容，仅供查看，不能继续修改。
                </Typography.Paragraph>
              </div>
            </Space>
          </Card>

          {loadError ? <Alert type="warning" showIcon message="加载提交详情失败" description={loadError} /> : null}

          {!detail ? (
            <Card className="search-case-card">
              <Empty description="当前没有可查看的提交详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          ) : (
            <>
              <Card className="search-case-card" title="提交信息">
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  <Typography.Text>{`任务编号：${detail.task_id}`}</Typography.Text>
                  <Typography.Text>{`提交时间：${new Date(detail.submitted_at).toLocaleString()}`}</Typography.Text>
                  <Typography.Text>{`领域：${detail.domain}`}</Typography.Text>
                  <Typography.Text>{`时效标签：${detail.timeliness_tag}`}</Typography.Text>
                </Space>
                <Space wrap style={{ marginTop: 16 }}>
                  <Tag>{`规则数 ${detail.rule_count}`}</Tag>
                  <Tag>{`扣分项 ${detail.penalty_rule_count}`}</Tag>
                  <Tag color="blue">{`A ${detail.score_summary.model_a_percentage}%`}</Tag>
                  <Tag color="cyan">{`B ${detail.score_summary.model_b_percentage}%`}</Tag>
                  <Tag color="gold">{`分差 ${detail.score_summary.score_gap}%`}</Tag>
                </Space>
              </Card>

              <Card className="search-case-card" title="场景说明">
                <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                  {detail.scenario_description}
                </Typography.Paragraph>
              </Card>

              <Card className="search-case-card" title="Prompt">
                <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                  {detail.prompt}
                </Typography.Paragraph>
              </Card>

              <Card className="search-case-card" title="模型一回答">
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Typography.Text type="secondary">{detail.model_a.model_name}</Typography.Text>
                  <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                    {detail.model_a.response_text}
                  </Typography.Paragraph>
                </Space>
              </Card>

              <Card className="search-case-card" title="模型二回答">
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Typography.Text type="secondary">{detail.model_b.model_name}</Typography.Text>
                  <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                    {detail.model_b.response_text}
                  </Typography.Paragraph>
                </Space>
              </Card>

              <Card className="search-case-card" title="参考答案">
                <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                  {detail.reference_answer}
                </Typography.Paragraph>
              </Card>

              <Card className="search-case-card" title="评分规则">
                <Table<SearchCaseRuleInput>
                  rowKey={(_, index) => String(index)}
                  pagination={false}
                  dataSource={detail.scoring_rules}
                  columns={[
                    { title: "分类", dataIndex: "rule_category", width: 180 },
                    { title: "权重", dataIndex: "weight", width: 100 },
                    { title: "证据来源", dataIndex: "evidence_source_type", width: 160 },
                    { title: "规则内容", dataIndex: "rule_text" },
                  ]}
                />
              </Card>
            </>
          )}
        </Space>
      </div>
    </Spin>
  );
}
