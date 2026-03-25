import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Input, Space, Typography } from "antd";
import type { ReactNode } from "react";

import type { ProjectTaskReviewAnnotationItem } from "../../types/api";

export type ModelResponseReviewCommentSectionKey =
  | "task_category"
  | "prompt"
  | "model_reply"
  | "answer_rating"
  | "rating_reason";

export const MODEL_RESPONSE_REVIEW_COMMENT_SECTIONS: Array<{
  key: ModelResponseReviewCommentSectionKey;
  label: string;
  placeholder: string;
}> = [
  {
    key: "task_category",
    label: "任务类型",
    placeholder: "说明任务类型判断是否合理，以及需要如何调整。",
  },
  {
    key: "prompt",
    label: "Prompt",
    placeholder: "指出题面理解、任务目标或上下文方面的问题。",
  },
  {
    key: "model_reply",
    label: "模型回答",
    placeholder: "指出模型回答中的关键问题点或需要重点关注的内容。",
  },
  {
    key: "answer_rating",
    label: "回答评级",
    placeholder: "说明评级是否准确，以及建议调整到什么档位。",
  },
  {
    key: "rating_reason",
    label: "评级理由",
    placeholder: "指出理由不充分、证据不足或表达需要补强的部分。",
  },
];

export function buildModelResponseReviewCommentMap(
  annotations: ProjectTaskReviewAnnotationItem[] | null | undefined,
): Partial<Record<ModelResponseReviewCommentSectionKey, string>> {
  const map: Partial<Record<ModelResponseReviewCommentSectionKey, string>> = {};
  for (const item of annotations ?? []) {
    if (
      item.section_key === "task_category" ||
      item.section_key === "prompt" ||
      item.section_key === "model_reply" ||
      item.section_key === "answer_rating" ||
      item.section_key === "rating_reason"
    ) {
      map[item.section_key] = item.comment;
    }
  }
  return map;
}

interface ModelResponseReviewSectionCardProps {
  title: string;
  children: ReactNode;
  extra?: ReactNode;
  id?: string;
}

export function ModelResponseReviewSectionCard({
  title,
  children,
  extra,
  id,
}: ModelResponseReviewSectionCardProps) {
  return (
    <Card id={id} title={title} className="review-card" extra={extra}>
      {children}
    </Card>
  );
}

interface ModelResponseReviewCommentDrawerProps {
  title: string;
  open: boolean;
  editable?: boolean;
  commentMap: Partial<Record<ModelResponseReviewCommentSectionKey, string>>;
  visible?: boolean;
  description?: string;
  onToggle: () => void;
  onCommentChange?: (key: ModelResponseReviewCommentSectionKey, value: string) => void;
}

export function ModelResponseReviewCommentDrawer({
  title,
  open,
  editable = false,
  commentMap,
  visible = true,
  description,
  onToggle,
  onCommentChange,
}: ModelResponseReviewCommentDrawerProps) {
  if (!visible) {
    return null;
  }

  const sections = editable
    ? MODEL_RESPONSE_REVIEW_COMMENT_SECTIONS
    : MODEL_RESPONSE_REVIEW_COMMENT_SECTIONS.filter((item) => Boolean(commentMap[item.key]?.trim()));

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
                      rows={section.key === "rating_reason" ? 7 : 5}
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
