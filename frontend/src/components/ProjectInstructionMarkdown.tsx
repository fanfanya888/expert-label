import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Empty, Typography } from "antd";
import { Fragment, useMemo, useRef, type ReactNode } from "react";

export interface MarkdownHeading {
  id: string;
  level: 1 | 2 | 3;
  text: string;
}

type MarkdownBlock =
  | { type: "heading"; id: string; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "code"; language: string | null; code: string };

export interface ParsedMarkdownDocument {
  headings: MarkdownHeading[];
  blocks: MarkdownBlock[];
}

function parseMarkdownDocument(markdown: string): ParsedMarkdownDocument {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { headings: [], blocks: [] };
  }

  const lines = normalized.split("\n");
  const headings: MarkdownHeading[] = [];
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeStart = line.match(/^```([\w-]+)?\s*$/);
    if (codeStart) {
      const codeLines: string[] = [];
      const language = codeStart[1] || null;
      index += 1;
      while (index < lines.length && !lines[index].trim().match(/^```$/)) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: "code", language, code: codeLines.join("\n") });
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      const text = headingMatch[2].trim();
      const id = `markdown-heading-${headings.length + 1}`;
      headings.push({ id, level, text });
      blocks.push({ type: "heading", id, level, text });
      index += 1;
      continue;
    }

    if (line.match(/^[-*+]\s+/)) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().match(/^[-*+]\s+/)) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().match(/^\d+\.\s+/)) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    if (line.match(/^>\s?/)) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().match(/^>\s?/)) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join("\n") });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trimEnd();
      if (!current.trim()) {
        break;
      }
      if (
        current.match(/^```/) ||
        current.match(/^(#{1,3})\s+/) ||
        current.match(/^[-*+]\s+/) ||
        current.match(/^\d+\.\s+/) ||
        current.match(/^>\s?/)
      ) {
        break;
      }
      paragraphLines.push(current.trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return { headings, blocks };
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      nodes.push(
        <img
          key={`${keyPrefix}-image-${match.index}`}
          className="project-markdown__image"
          src={match[2]}
          alt={match[1] || "instruction"}
        />,
      );
    } else if (match[3] !== undefined && match[4] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${match.index}`}
          href={match[4]}
          target="_blank"
          rel="noreferrer"
          className="project-markdown__link"
        >
          {match[3]}
        </a>,
      );
    } else if (match[5] !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-code-${match.index}`} className="project-markdown__inline-code">
          {match[5]}
        </code>,
      );
    } else if (match[6] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-strong-${match.index}`}>{match[6]}</strong>);
    } else if (match[7] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-em-${match.index}`}>{match[7]}</em>);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderMarkdownBlock(block: MarkdownBlock, index: number) {
  if (block.type === "heading") {
    if (block.level === 1) {
      return (
        <Typography.Title key={block.id} id={block.id} level={4} className="project-markdown__heading project-markdown__heading--h1">
          {block.text}
        </Typography.Title>
      );
    }
    if (block.level === 2) {
      return (
        <Typography.Title key={block.id} id={block.id} level={5} className="project-markdown__heading project-markdown__heading--h2">
          {block.text}
        </Typography.Title>
      );
    }
    return (
      <Typography.Text key={block.id} id={block.id} strong className="project-markdown__heading project-markdown__heading--h3">
        {block.text}
      </Typography.Text>
    );
  }

  if (block.type === "paragraph") {
    return (
      <Typography.Paragraph key={`paragraph-${index}`} className="project-markdown__paragraph">
        {renderInlineMarkdown(block.text, `paragraph-${index}`)}
      </Typography.Paragraph>
    );
  }

  if (block.type === "unordered-list") {
    return (
      <ul key={`unordered-${index}`} className="project-markdown__list">
        {block.items.map((item, itemIndex) => (
          <li key={`unordered-${index}-${itemIndex}`}>{renderInlineMarkdown(item, `unordered-${index}-${itemIndex}`)}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "ordered-list") {
    return (
      <ol key={`ordered-${index}`} className="project-markdown__list project-markdown__list--ordered">
        {block.items.map((item, itemIndex) => (
          <li key={`ordered-${index}-${itemIndex}`}>{renderInlineMarkdown(item, `ordered-${index}-${itemIndex}`)}</li>
        ))}
      </ol>
    );
  }

  if (block.type === "blockquote") {
    return (
      <blockquote key={`blockquote-${index}`} className="project-markdown__blockquote">
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {renderInlineMarkdown(block.text, `blockquote-${index}`)}
        </Typography.Paragraph>
      </blockquote>
    );
  }

  return (
    <pre key={`code-${index}`} className="project-markdown__code-block">
      <code>{block.code}</code>
    </pre>
  );
}

export function MarkdownDocumentPreview({
  markdown,
  emptyDescription = "暂无说明文档",
}: {
  markdown: string;
  emptyDescription?: string;
}) {
  const parsed = useMemo(() => parseMarkdownDocument(markdown), [markdown]);

  if (!parsed.blocks.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />;
  }

  return <div className="project-markdown">{parsed.blocks.map((block, index) => renderMarkdownBlock(block, index))}</div>;
}

export function MarkdownOutline({
  headings,
  onNavigate,
  emptyDescription = "当前文档没有可导航标题",
}: {
  headings: MarkdownHeading[];
  onNavigate?: (headingId: string) => void;
  emptyDescription?: string;
}) {
  if (!headings.length) {
    return (
      <Typography.Text type="secondary" className="project-markdown__outline-empty">
        {emptyDescription}
      </Typography.Text>
    );
  }

  return (
    <div className="project-markdown__outline">
      {headings.map((heading) => (
        <button
          key={heading.id}
          type="button"
          className={`project-markdown__outline-item project-markdown__outline-item--level-${heading.level}`}
          onClick={() => onNavigate?.(heading.id)}
        >
          {heading.text}
        </button>
      ))}
    </div>
  );
}

export function ProjectInstructionDrawer({
  title = "说明文档",
  open,
  markdown,
  visible = true,
  onToggle,
}: {
  title?: string;
  open: boolean;
  markdown: string;
  visible?: boolean;
  onToggle: () => void;
}) {
  const parsed = useMemo(() => parseMarkdownDocument(markdown), [markdown]);
  const contentRef = useRef<HTMLDivElement>(null);

  if (!visible) {
    return null;
  }

  const handleNavigate = (headingId: string) => {
    const target = contentRef.current?.querySelector<HTMLElement>(`#${headingId}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <aside className={`project-instruction-drawer${open ? " project-instruction-drawer--open" : ""}`}>
      <Button
        type="text"
        className="project-instruction-drawer__toggle"
        icon={open ? <LeftOutlined /> : <RightOutlined />}
        onClick={onToggle}
      >
        说明
      </Button>

      <div className="project-instruction-drawer__panel">
        <div className="project-instruction-drawer__header">
          <Typography.Title level={5} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
            目录按 Markdown 标题自动生成。
          </Typography.Paragraph>
        </div>

        <div className="project-instruction-drawer__toc">
          <Typography.Text strong>目录导航</Typography.Text>
          <MarkdownOutline headings={parsed.headings} onNavigate={handleNavigate} />
        </div>

        <div ref={contentRef} className="project-instruction-drawer__body">
          {parsed.blocks.length ? (
            <div className="project-markdown">
              {parsed.blocks.map((block, index) => (
                <Fragment key={`${block.type}-${index}`}>{renderMarkdownBlock(block, index)}</Fragment>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无说明文档" />
          )}
        </div>
      </div>
    </aside>
  );
}

export function useParsedMarkdownDocument(markdown: string) {
  return useMemo(() => parseMarkdownDocument(markdown), [markdown]);
}
