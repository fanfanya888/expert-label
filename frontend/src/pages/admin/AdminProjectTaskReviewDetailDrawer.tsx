import {
  Alert,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import type {
  ModelResponseReviewSubmissionRecord,
  ProjectTaskReviewTaskDetail,
  SingleTurnSearchCaseSubmissionDetail,
} from "../../types/api";
import {
  buildModelResponseReviewCommentMap,
  ModelResponseReviewCommentDrawer,
  ModelResponseReviewSectionCard,
} from "../user/modelResponseReviewWorkspace";
import {
  buildSingleTurnSearchCaseCommentMap,
  SingleTurnSearchCaseCommentDrawer,
} from "../user/singleTurnSearchCaseReviewWorkspace";

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "-";
}

function formatUserText(username: string | null | undefined, userId: number | null | undefined) {
  if (username && userId) return `${username} (#${userId})`;
  if (username) return username;
  if (userId) return `#${userId}`;
  return "-";
}

function getReviewStatusText(status: string) {
  if (status === "pending") return "待领取";
  if (status === "in_progress") return "质检中";
  if (status === "waiting_resubmission") return "等待重提";
  if (status === "submitted") return "已提交";
  return status;
}

function getReviewResultText(result: string | null) {
  if (result === "pass") return "通过";
  if (result === "reject") return "打回";
  return "-";
}

function getReviewResultTagColor(result: string | null) {
  if (result === "pass") return "green";
  if (result === "reject") return "orange";
  return "default";
}

function getEvidenceSourceText(sourceType: string) {
  if (sourceType === "web_link") return "网页链接";
  if (sourceType === "prompt_requirement") return "题目要求";
  if (sourceType === "project_document") return "项目文档";
  if (sourceType === "none") return "无";
  return sourceType;
}

function getEvaluationResultText(hit: boolean | undefined) {
  if (hit === true) return "命中";
  if (hit === false) return "未命中";
  return "未填写";
}

function findSearchCaseEvaluation(
  evaluations: SingleTurnSearchCaseSubmissionDetail["model_a_evaluations"],
  ruleIndex: number,
) {
  return evaluations.find((item) => item.rule_index === ruleIndex) || null;
}

function isSingleTurnSearchCaseSubmissionDetail(
  value: unknown,
): value is SingleTurnSearchCaseSubmissionDetail {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "model_a" in value &&
    "model_b" in value &&
    "scoring_rules" in value &&
    "model_a_evaluations" in value &&
    "model_b_evaluations" in value &&
    "score_summary" in value
  );
}

function SearchCaseModelCard({
  title,
  model,
}: {
  title: string;
  model: SingleTurnSearchCaseSubmissionDetail["model_a"];
}) {
  return (
    <Card className="search-case-card" title={title}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Text type="secondary">{model.model_name}</Typography.Text>
        <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
          {model.response_text}
        </Typography.Paragraph>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="分享链接">
            {model.share_link ? (
              <a href={model.share_link} target="_blank" rel="noreferrer">
                打开分享链接
              </a>
            ) : (
              "-"
            )}
          </Descriptions.Item>
        </Descriptions>
        {model.screenshot ? (
          <div>
            <Typography.Text type="secondary">截图</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <img
                src={model.screenshot}
                alt={`${model.model_name} screenshot`}
                style={{
                  width: "100%",
                  maxHeight: 280,
                  objectFit: "contain",
                  borderRadius: 12,
                  border: "1px solid #e7ecf3",
                  background: "#f8fbff",
                }}
              />
            </div>
          </div>
        ) : null}
      </Space>
    </Card>
  );
}

function SearchCaseRulesSection({
  detail,
}: {
  detail: SingleTurnSearchCaseSubmissionDetail;
}) {
  return (
    <Card className="search-case-card" title="评分规则区">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {detail.scoring_rules.map((rule, index) => {
          const modelAEvaluation = findSearchCaseEvaluation(detail.model_a_evaluations, index);
          const modelBEvaluation = findSearchCaseEvaluation(detail.model_b_evaluations, index);

          return (
            <Card
              key={`${detail.task_id}-rule-${index}`}
              type="inner"
              title={`规则 ${index + 1}`}
              extra={<Tag color={Number(rule.weight) < 0 ? "orange" : "blue"}>{`权重 ${rule.weight}`}</Tag>}
            >
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
                  <Descriptions.Item label="规则分类">{rule.rule_category || "-"}</Descriptions.Item>
                  <Descriptions.Item label="证据来源">
                    {getEvidenceSourceText(rule.evidence_source_type)}
                  </Descriptions.Item>
                  <Descriptions.Item label="规则内容" span={2}>
                    {rule.rule_text || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="参考链接" span={2}>
                    {rule.reference_url ? (
                      <a href={rule.reference_url} target="_blank" rel="noreferrer">
                        {rule.reference_url}
                      </a>
                    ) : (
                      "-"
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="引用说明" span={2}>
                    {rule.quote_text || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="补充说明" span={2}>
                    {rule.optional_note || "-"}
                  </Descriptions.Item>
                </Descriptions>

                {rule.evidence_screenshot ? (
                  <div>
                    <Typography.Text type="secondary">证据截图</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <img
                        src={rule.evidence_screenshot}
                        alt={`rule-${index + 1}-evidence`}
                        style={{
                          width: "100%",
                          maxHeight: 260,
                          objectFit: "contain",
                          borderRadius: 12,
                          border: "1px solid #e7ecf3",
                          background: "#f8fbff",
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={12}>
                    <Card size="small" title={`${detail.model_a.model_name} 判定`}>
                      <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="是否命中">
                          {getEvaluationResultText(modelAEvaluation?.hit)}
                        </Descriptions.Item>
                        <Descriptions.Item label="备注">{modelAEvaluation?.note || "-"}</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                  <Col xs={24} xl={12}>
                    <Card size="small" title={`${detail.model_b.model_name} 判定`}>
                      <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="是否命中">
                          {getEvaluationResultText(modelBEvaluation?.hit)}
                        </Descriptions.Item>
                        <Descriptions.Item label="备注">{modelBEvaluation?.note || "-"}</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                </Row>
              </Space>
            </Card>
          );
        })}
      </Space>
    </Card>
  );
}

function SearchCaseScoreSummarySection({
  detail,
}: {
  detail: SingleTurnSearchCaseSubmissionDetail;
}) {
  return (
    <Card className="search-case-card" title="自动统计区">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={8}>
          <Card size="small">
            <Typography.Text type="secondary">正分总分</Typography.Text>
            <Typography.Title level={3}>{detail.score_summary.positive_total_score}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={8}>
          <Card size="small">
            <Typography.Text type="secondary">{detail.model_a.model_name}</Typography.Text>
            <Typography.Title level={3}>
              {`${detail.score_summary.model_a_raw_score} / ${detail.score_summary.model_a_percentage}%`}
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={8}>
          <Card size="small">
            <Typography.Text type="secondary">{detail.model_b.model_name}</Typography.Text>
            <Typography.Title level={3}>
              {`${detail.score_summary.model_b_raw_score} / ${detail.score_summary.model_b_percentage}%`}
            </Typography.Title>
          </Card>
        </Col>
      </Row>

      <Space wrap style={{ marginTop: 16 }}>
        <Tag color={detail.score_summary.model_a_below_target ? "red" : "green"}>
          {detail.score_summary.model_a_below_target
            ? `${detail.model_a.model_name} 低于 50%`
            : `${detail.model_a.model_name} 达到 50%`}
        </Tag>
        <Tag color={detail.score_summary.score_gap_exceeds_target ? "orange" : "green"}>
          {detail.score_summary.score_gap_exceeds_target ? "双模型分差超过 15%" : "双模型分差在阈值内"}
        </Tag>
        <Tag>{`分差 ${detail.score_summary.score_gap}%`}</Tag>
        <Tag>{`扣分项 ${detail.penalty_rule_count}`}</Tag>
      </Space>

      <div style={{ marginTop: 16 }}>
        <Typography.Title level={5}>软校验提示</Typography.Title>
        {detail.soft_checks.length === 0 ? (
          <Alert type="success" showIcon message="当前没有额外软风险提示" />
        ) : (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            {detail.soft_checks.map((item) => (
              <Alert
                key={`${item.code}-${item.message}`}
                type={item.level === "warning" ? "warning" : "info"}
                showIcon
                message={item.message}
              />
            ))}
          </Space>
        )}
      </div>
    </Card>
  );
}

interface AdminProjectTaskReviewDetailDrawerProps {
  open: boolean;
  loading: boolean;
  detail: ProjectTaskReviewTaskDetail | null;
  projectName?: string | null;
  onClose: () => void;
}

export function AdminProjectTaskReviewDetailDrawer({
  open,
  loading,
  detail,
  projectName,
  onClose,
}: AdminProjectTaskReviewDetailDrawerProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    setCommentsOpen(false);
  }, [open, detail?.review.id]);

  const isModelResponseReview = detail?.task.plugin_code === "model_response_review";
  const isSearchCase = detail?.task.plugin_code === "single_turn_search_case";

  const modelResponseSubmission = isModelResponseReview
    ? (detail?.submission as ModelResponseReviewSubmissionRecord | null)
    : null;
  const searchCaseSubmission =
    isSearchCase && isSingleTurnSearchCaseSubmissionDetail(detail?.submission)
      ? detail.submission
      : null;

  const submissionId = useMemo(() => {
    if (!detail?.submission || typeof detail.submission !== "object") {
      return null;
    }
    const value = (detail.submission as { submission_id?: unknown }).submission_id;
    return typeof value === "number" ? value : null;
  }, [detail]);

  const submissionTime = useMemo(() => {
    if (!detail?.submission || typeof detail.submission !== "object") {
      return null;
    }
    const value = (detail.submission as { submitted_at?: unknown }).submitted_at;
    return typeof value === "string" ? value : null;
  }, [detail]);

  const modelResponseCommentMap = buildModelResponseReviewCommentMap(detail?.review.review_annotations);
  const searchCaseCommentMap = buildSingleTurnSearchCaseCommentMap(detail?.review.review_annotations);
  const hasModelResponseComments = Object.values(modelResponseCommentMap).some((value) => Boolean(value?.trim()));
  const hasSearchCaseComments = Object.values(searchCaseCommentMap).some((value) => Boolean(value?.trim()));

  return (
    <Drawer
      title={detail ? `质检详情 / 第 ${detail.review.review_round} 轮` : "质检详情"}
      width={1280}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        {detail ? (
          <Space direction="vertical" size={20} style={{ width: "100%", paddingBottom: 24 }}>
            <Card className={isSearchCase ? "search-case-card" : "review-card"}>
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {projectName || "项目"} / 历史质检详情
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  这是管理端 V1 只读页面。展示内容基于该轮质检时间匹配到的最近一次标注提交快照，用来快速回看当时质检页面。
                </Typography.Paragraph>
              </Space>
            </Card>

            <Alert
              type={detail.submission ? "info" : "warning"}
              showIcon
              message={detail.submission ? "已匹配到对应提交快照" : "未匹配到提交快照"}
              description={
                detail.submission
                  ? `提交记录 #${submissionId ?? "-"}，提交时间 ${formatDateTime(submissionTime)}`
                  : "当前只能查看这一轮质检本身的结果与批注，提交内容快照未取回。"
              }
            />

            {isModelResponseReview && hasModelResponseComments ? (
              <ModelResponseReviewCommentDrawer
                title="本轮模块批注"
                open={commentsOpen}
                commentMap={modelResponseCommentMap}
                description="只读展示该轮质检写下的模块批注。"
                onToggle={() => setCommentsOpen((value) => !value)}
              />
            ) : null}

            {isSearchCase && hasSearchCaseComments ? (
              <SingleTurnSearchCaseCommentDrawer
                title="本轮模块批注"
                open={commentsOpen}
                commentMap={searchCaseCommentMap}
                description="只读展示该轮质检写下的模块批注。"
                onToggle={() => setCommentsOpen((value) => !value)}
              />
            ) : null}

            <Card className={isSearchCase ? "search-case-card" : "review-card"} title="本轮质检概览">
              <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
                <Descriptions.Item label="质检轮次">{detail.review.review_round}</Descriptions.Item>
                <Descriptions.Item label="质检状态">{getReviewStatusText(detail.review.review_status)}</Descriptions.Item>
                <Descriptions.Item label="质检结论">
                  <Tag color={getReviewResultTagColor(detail.review.review_result)}>
                    {getReviewResultText(detail.review.review_result)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="质检人">
                  {formatUserText(detail.review.reviewer_username, detail.review.reviewer_id)}
                </Descriptions.Item>
                <Descriptions.Item label="质检提交时间">
                  {formatDateTime(detail.review.submitted_at)}
                </Descriptions.Item>
                <Descriptions.Item label="标注人">
                  {formatUserText(detail.task.annotation_assignee_username, detail.task.annotation_assignee_id)}
                </Descriptions.Item>
                <Descriptions.Item label="标注提交时间">
                  {formatDateTime(detail.task.annotation_submitted_at)}
                </Descriptions.Item>
                <Descriptions.Item label="任务标识">{detail.task.external_task_id}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card className={isSearchCase ? "search-case-card" : "review-card"} title="本轮整体说明">
              <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                {detail.review.review_comment || "-"}
              </Typography.Paragraph>
            </Card>

            {isModelResponseReview ? (
              modelResponseSubmission ? (
                <>
                  <ModelResponseReviewSectionCard title="任务类型">
                    <Typography.Text>{modelResponseSubmission.task_category}</Typography.Text>
                  </ModelResponseReviewSectionCard>

                  <ModelResponseReviewSectionCard title="Prompt">
                    <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                      {modelResponseSubmission.prompt_snapshot}
                    </Typography.Paragraph>
                  </ModelResponseReviewSectionCard>

                  <ModelResponseReviewSectionCard title="模型回答">
                    <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                      {modelResponseSubmission.model_reply_snapshot}
                    </Typography.Paragraph>
                  </ModelResponseReviewSectionCard>

                  <ModelResponseReviewSectionCard title="回答评级">
                    <Tag color="blue">{modelResponseSubmission.answer_rating}</Tag>
                  </ModelResponseReviewSectionCard>

                  <ModelResponseReviewSectionCard title="评级理由">
                    <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                      {modelResponseSubmission.rating_reason}
                    </Typography.Paragraph>
                  </ModelResponseReviewSectionCard>
                </>
              ) : (
                <Alert type="warning" showIcon message="未拿到该轮对应的标注快照" />
              )
            ) : null}

            {isSearchCase ? (
              searchCaseSubmission ? (
                <>
                  <Card className="search-case-card" title="出题信息区">
                    <Space direction="vertical" size={16} style={{ width: "100%" }}>
                      <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
                        <Descriptions.Item label="题目领域">{searchCaseSubmission.domain}</Descriptions.Item>
                        <Descriptions.Item label="时效标签">{searchCaseSubmission.timeliness_tag}</Descriptions.Item>
                      </Descriptions>
                      <div>
                        <Typography.Text type="secondary">场景说明</Typography.Text>
                        <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0, marginTop: 8 }}>
                          {searchCaseSubmission.scenario_description}
                        </Typography.Paragraph>
                      </div>
                      <div>
                        <Typography.Text type="secondary">Prompt</Typography.Text>
                        <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0, marginTop: 8 }}>
                          {searchCaseSubmission.prompt}
                        </Typography.Paragraph>
                      </div>
                    </Space>
                  </Card>

                  <Row gutter={[18, 18]}>
                    <Col xs={24} xl={12}>
                      <SearchCaseModelCard title="模型一回复录入区" model={searchCaseSubmission.model_a} />
                    </Col>
                    <Col xs={24} xl={12}>
                      <SearchCaseModelCard title="模型二回复录入区" model={searchCaseSubmission.model_b} />
                    </Col>
                  </Row>

                  <Card className="search-case-card" title="参考答案区">
                    <Typography.Paragraph className="review-text-block" style={{ marginBottom: 0 }}>
                      {searchCaseSubmission.reference_answer}
                    </Typography.Paragraph>
                  </Card>

                  <SearchCaseRulesSection detail={searchCaseSubmission} />

                  <SearchCaseScoreSummarySection detail={searchCaseSubmission} />
                </>
              ) : detail.submission ? (
                <Alert
                  type="warning"
                  showIcon
                  message="当前提交快照不完整"
                  description="这条质检记录返回的是提交摘要而不是完整详情，已避免页面白屏；如果刷新后仍出现，说明后端还没加载到最新代码。"
                />
              ) : (
                <Alert type="warning" showIcon message="未拿到该轮对应的标注快照" />
              )
            ) : null}

            {!isModelResponseReview && !isSearchCase ? (
              <Card className="panel-card">
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(detail.submission, null, 2)}
                </pre>
              </Card>
            ) : null}
          </Space>
        ) : (
          <Empty description="暂无质检详情" />
        )}
      </Spin>
    </Drawer>
  );
}
