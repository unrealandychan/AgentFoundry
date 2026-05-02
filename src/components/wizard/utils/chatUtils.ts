import type { ReactNode } from "react";
import { Fragment } from "react";
import React from "react";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  agentName?: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  instructions: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const MODELS = [
  { id: "gpt-4o-mini", label: "gpt-4o-mini", note: "Fast & cheap — good for testing" },
  { id: "gpt-4o", label: "gpt-4o", note: "Smarter, slower" },
  { id: "gpt-4.1", label: "gpt-4.1", note: "Latest GPT-4 series" },
  { id: "gpt-5.4", label: "gpt-5.4", note: "Most capable (Apr 2026)" },
];

// Approximate pricing per 1 M tokens (input / output) — used only for rough estimates
export const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
  "gpt-5.4": { inputPer1M: 10, outputPer1M: 30 },
};

// Stable palette — agent i gets color i % 6
export const AGENT_COLORS = [
  "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  "bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
];

// Max chars sent per agent. GPT-4o context is 128 K tokens; 24 000 chars ≈ 6 000 tokens
// leaving ample room for conversation history and workspace files.
export const MAX_INSTRUCTIONS_CHARS = 24_000;

// ── Utility functions ───────────────────────────────────────────────────────

/**
 * Smart truncation: preserves the role/persona opening (most important for
 * model behaviour) and the output-format/constraints tail (most important for
 * response quality). Middle "phase" sections are trimmed first.
 */
export function truncateInstructions(text: string): string {
  if (text.length <= MAX_INSTRUCTIONS_CHARS) return text;

  const keepHead = Math.floor(MAX_INSTRUCTIONS_CHARS * 0.6); // 14 400 chars
  const keepTail = Math.floor(MAX_INSTRUCTIONS_CHARS * 0.35); // 8 400 chars
  const notice = "\n\n[... middle sections trimmed to fit context window ...]\n\n";

  return text.slice(0, keepHead) + notice + text.slice(text.length - keepTail);
}

export function estimateCost(model: string, charsIn: number, charsOut: number): string {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["gpt-4o-mini"];
  const tokensIn = charsIn / 4;
  const tokensOut = charsOut / 4;
  const cost =
    (tokensIn / 1_000_000) * pricing.inputPer1M + (tokensOut / 1_000_000) * pricing.outputPer1M;
  if (cost < 0.000_01) return "< $0.00001";
  return `~$${cost.toFixed(5)}`;
}

export function agentColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length] ?? AGENT_COLORS[0];
}

export function buildTabClass(active: boolean, colorClass: string | undefined): string {
  if (!active) return "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300";
  return colorClass ? `border-current ${colorClass}` : "border-indigo-600 text-indigo-700 dark:text-indigo-300";
}

export function chatEmptyMessage(agentCount: number, hasMessages: boolean, isFiltered: boolean): string {
  if (agentCount === 0) return "Go back and choose a template to enable the agent.";
  if (isFiltered && hasMessages) return "No messages from this agent yet.";
  return "Send a message to test the agent.";
}

// ── Lightweight markdown renderer ───────────────────────────────────────────

export function inlineMarkdown(text: string): ReactNode[] {
  // Process inline: **bold**, *italic*, `code`, and plain text
  const parts: ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(
        React.createElement("code", {
          key: key++,
          className: "rounded bg-gray-200 dark:bg-gray-700 px-1 py-0.5 text-[0.8em] font-mono text-slate-800 dark:text-slate-100",
        }, token.slice(1, -1)),
      );
    } else if (token.startsWith("**")) {
      parts.push(React.createElement("strong", { key: key++ }, token.slice(2, -2)));
    } else {
      parts.push(React.createElement("em", { key: key++ }, token.slice(1, -1)));
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function renderMarkdown(content: string): ReactNode {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;
  let blockKey = 0;

  while (index < lines.length) {
    const line = lines[index];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index++]);
      }
      nodes.push(
        React.createElement("pre", {
          key: blockKey++,
          className: "my-2 overflow-x-auto rounded-lg bg-gray-800 px-4 py-3 text-[0.8em] leading-relaxed text-gray-100",
        }, React.createElement("code", { className: lang ? `language-${lang}` : "" }, codeLines.join("\n"))),
      );
      index++;
      continue;
    }

    // ATX Headings
    const h3 = /^### (.+)/.exec(line);
    const h2 = /^## (.+)/.exec(line);
    const h1 = /^# (.+)/.exec(line);
    if (h3) {
      nodes.push(
        React.createElement("h3", { key: blockKey++, className: "mb-1 mt-3 text-sm font-semibold text-slate-900 dark:text-white" }, inlineMarkdown(h3[1])),
      );
      index++;
      continue;
    }
    if (h2) {
      nodes.push(
        React.createElement("h2", { key: blockKey++, className: "mb-1 mt-3 text-base font-bold text-slate-900 dark:text-white" }, inlineMarkdown(h2[1])),
      );
      index++;
      continue;
    }
    if (h1) {
      nodes.push(
        React.createElement("h1", { key: blockKey++, className: "mb-1 mt-3 text-lg font-bold text-slate-900 dark:text-white" }, inlineMarkdown(h1[1])),
      );
      index++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quoteLines.push(lines[index].slice(2));
        index++;
      }
      nodes.push(
        React.createElement("blockquote", {
          key: blockKey++,
          className: "my-1 border-l-4 border-indigo-300 dark:border-indigo-700 pl-3 text-slate-600 dark:text-slate-300 italic",
        }, quoteLines.map((ql, qi) =>
          React.createElement(Fragment, { key: qi },
            inlineMarkdown(ql),
            qi < quoteLines.length - 1 ? React.createElement("br") : null,
          ),
        )),
      );
      continue;
    }

    // GFM table  (line has at least one |)
    if (/^\|.+\|/.test(line) && index + 1 < lines.length && /^\|[ :|-]+\|/.test(lines[index + 1])) {
      const headers = line
        .split("|")
        .filter((_, index_, array) => index_ > 0 && index_ < array.length - 1)
        .map((col) => col.trim());
      index += 2; // skip header + separator rows
      const rows: string[][] = [];
      while (index < lines.length && /^\|.+\|/.test(lines[index])) {
        rows.push(
          lines[index]
            .split("|")
            .filter((_, index_, array) => index_ > 0 && index_ < array.length - 1)
            .map((col) => col.trim()),
        );
        index++;
      }
      nodes.push(
        React.createElement("div", { key: blockKey++, className: "my-2 overflow-x-auto" },
          React.createElement("table", { className: "w-full text-left text-xs" },
            React.createElement("thead", null,
              React.createElement("tr", { className: "border-b border-gray-300" },
                headers.map((header, hi) =>
                  React.createElement("th", { key: hi, className: "py-1 pr-4 font-semibold text-slate-800 dark:text-slate-100" }, inlineMarkdown(header)),
                ),
              ),
            ),
            React.createElement("tbody", null,
              rows.map((row, ri) =>
                React.createElement("tr", { key: ri, className: "border-b border-gray-200 dark:border-gray-700" },
                  row.map((cell, ci) =>
                    React.createElement("td", { key: ci, className: "py-1 pr-4 text-slate-700 dark:text-slate-300" }, inlineMarkdown(cell)),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      continue;
    }

    // Unordered list  (- item or * item)
    if (/^[*-] /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[*-] /.test(lines[index])) {
        items.push(lines[index].slice(2));
        index++;
      }
      nodes.push(
        React.createElement("ul", { key: blockKey++, className: "my-1 list-disc pl-5" },
          items.map((item, ii) =>
            React.createElement("li", { key: ii, className: "my-0 text-slate-700 dark:text-slate-300" }, inlineMarkdown(item)),
          ),
        ),
      );
      continue;
    }

    // Ordered list  (1. item)
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\. /, ""));
        index++;
      }
      nodes.push(
        React.createElement("ol", { key: blockKey++, className: "my-1 list-decimal pl-5" },
          items.map((item, ii) =>
            React.createElement("li", { key: ii, className: "my-0 text-slate-700 dark:text-slate-300" }, inlineMarkdown(item)),
          ),
        ),
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(React.createElement("hr", { key: blockKey++, className: "my-2 border-gray-200 dark:border-gray-700" }));
      index++;
      continue;
    }

    // Blank line → paragraph break
    if (line.trim() === "") {
      index++;
      continue;
    }

    // Regular paragraph line
    nodes.push(
      React.createElement("p", { key: blockKey++, className: "my-1 text-slate-800 dark:text-slate-100" }, inlineMarkdown(line)),
    );
    index++;
  }

  return React.createElement(React.Fragment, null, ...nodes);
}
