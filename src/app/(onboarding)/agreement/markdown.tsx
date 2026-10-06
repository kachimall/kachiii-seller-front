import { Fragment, type ReactNode } from "react";

/**
 * A small Markdown renderer for the agreement text: headings, paragraphs, bullet and numbered
 * lists, bold and italics. Everything becomes React text nodes, so the input is never parsed as
 * HTML; anything else (links, tables, raw HTML) shows as plain text.
 */
export function Markdown({ source }: { source: string }) {
  return <div className="grid gap-3 text-sm leading-relaxed">{parseBlocks(source).map(renderBlock)}</div>;
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);

    if (line.trim() === "") {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
    } else if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered);
      const text = (bullet ?? numbered)![1];
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list" && last.ordered === ordered) last.items.push(text);
      else blocks.push({ kind: "list", ordered, items: [text] });
    } else {
      const last = blocks[blocks.length - 1];
      // An indented line straight after a list item continues it.
      if (paragraph.length === 0 && last?.kind === "list" && /^\s/.test(raw)) {
        last.items[last.items.length - 1] += ` ${line.trim()}`;
      } else {
        paragraph.push(line.trim());
      }
    }
  }
  flush();
  return blocks;
}

const HEADING_CLASSES = ["font-heading text-headline-sm", "font-heading text-base font-bold", "text-sm font-semibold"];

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.kind) {
    case "heading": {
      // The page title is the h1, so # starts at h2.
      const Tag = (["h2", "h3", "h4", "h5", "h6", "h6"] as const)[block.level - 1];
      return (
        <Tag key={index} className={`${HEADING_CLASSES[Math.min(block.level, 3) - 1]} mt-3 first:mt-0`}>
          {inline(block.text)}
        </Tag>
      );
    }
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag key={index} className={`grid gap-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </Tag>
      );
    }
    case "paragraph":
      return <p key={index}>{inline(block.text)}</p>;
  }
}

// Underscores are left alone: they also appear inside words and references.
const INLINE = /(\*\*[^*]+?\*\*|\*[^*\s][^*]*?\*)/g;

/** **bold** and *italic*; the markers themselves are dropped. */
function inline(text: string): ReactNode {
  return text.split(INLINE).map((part, i) => {
    if (/^\*\*.+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*.+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
