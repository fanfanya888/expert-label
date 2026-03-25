import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Input, Space, Typography } from "antd";

import type { ProjectTaskReviewAnnotationItem } from "../../types/api";

export type SingleTurnSearchCaseCommentSectionKey =
  | "question_info"
  | "model_a_response"
  | "model_b_response"
  | "reference_answer"
  | "scoring_rules"
  | "score_summary";

export const SINGLE_TURN_SEARCH_CASE_COMMENT_SECTIONS: Array<{
  key: SingleTurnSearchCaseCommentSectionKey;
  label: string;
  placeholder: string;
}> = [
  {
    key: "question_info",
    label: "出题信息区",
    placeholder: "指出领域、时效标签、场景说明或 Prompt 里的问题，说明需要怎样修改。",
  },
  {
    key: "model_a_response",
    label: "模型一回复录入区",
    placeholder: "指出模型一回答、分享链接或截图相关的问题和建议。",
  },
  {
    key: "model_b_response",
    label: "模型二回复录入区",
    placeholder: "指出模型二回答、分享链接或截图相关的问题和建议。",
  },
  {
    key: "reference_answer",
    label: "参考答案区",
    placeholder: "指出参考答案在完整性、准确性或可核验性上的问题。",
  },
  {
    key: "scoring_rules",
    label: "评分规则区",
    placeholder: "指出评分规则、证据来源或模型判定备注的问题。",
  },
  {
    key: "score_summary",
    label: "自动统计区",
    placeholder: "指出分数汇总、软校验提示或整体结果上的问题。",
  },
];

export function buildSingleTurnSearchCaseCommentMap(
  annotations: ProjectTaskReviewAnnotationItem[] | null | undefined,
): Partial<Record<SingleTurnSearchCaseCommentSectionKey, string>> {
  const map: Partial<Record<SingleTurnSearchCaseCommentSectionKey, string>> = {};
  for (const item of annotations ?? []) {
    if (
      item.section_key === "question_info" ||
      item.section_key === "model_a_response" ||
      item.section_key === "model_b_response" ||
      item.section_key === "reference_answer" ||
      item.section_key === "scoring_rules" ||
      item.section_key === "score_summary"
    ) {
      map[item.section_key] = item.comment;
    }
  }
  return map;
}

interface SingleTurnSearchCaseCommentDrawerProps {
  title: string;
  open: boolean;
  editable?: boolean;
  commentMap: Partial<Record<SingleTurnSearchCaseCommentSectionKey, string>>;
  visible?: boolean;
  description?: string;
  onToggle: () => void;
  onCommentChange?: (key: SingleTurnSearchCaseCommentSectionKey, value: string) => void;
}

export function SingleTurnSearchCaseCommentDrawer({
  title,
  open,
  editable = false,
  commentMap,
  visible = true,
  description,
  onToggle,
  onCommentChange,
}: SingleTurnSearchCaseCommentDrawerProps) {
  if (!visible) {
    return null;
  }

  const sections = editable
    ? SINGLE_TURN_SEARCH_CASE_COMMENT_SECTIONS
    : SINGLE_TURN_SEARCH_CASE_COMMENT_SECTIONS.filter((item) => Boolean(commentMap[item.key]?.trim()));

  return (
    <aside className={`mrr-comment-drawer${open ? " mrr-comment-drawer--open" : ""}`}>
      <Button
        type="text"
        className="mrr-comment-drawer__toggle"
        icon={open ? <RightOutlined /> : <LeftOutlined />}
        onClick={onToggle}
      >
        批注
      </Button>

      <div className="mrr-comment-drawer__panel">
        <div className="mrr-comment-drawer__header">
          <Typography.Title level={5} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {description ? (
            <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
              {description}
            </Typography.Paragraph>
          ) : null}
        </div>

        <div className="mrr-comment-drawer__body">
          {sections.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={editable ? "按模块填写批注" : "当前没有批注内容"}
            />
          ) : (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {sections.map((section) => (
                <Card key={section.key} size="small" className="mrr-comment-drawer__section" title={section.label}>
                  {editable ? (
                    <Input.TextArea
                      rows={section.key === "scoring_rules" ? 7 : 5}
                      value={commentMap[section.key] || ""}
                      maxLength={2000}
                      showCount
                      placeholder={section.placeholder}
                      onChange={(event) => onCommentChange?.(section.key, event.target.value)}
                    />
                  ) : (
                    <Typography.Paragraph className="mrr-comment-drawer__text" style={{ marginBottom: 0 }}>
                      {commentMap[section.key]}
                    </Typography.Paragraph>
                  )}
                </Card>
              ))}
            </Space>
          )}
        </div>
      </div>
    </aside>
  );
}
