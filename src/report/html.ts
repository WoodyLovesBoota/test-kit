import type { RunSummary, TestAttachment, TestRecord, TestStatus, ToolCounts, ToolResultFile } from "../types";
import { CLIENT_SCRIPT } from "./client";
import { STYLES } from "./styles";

export interface RenderInput {
  title: string;
  summary: RunSummary;
  files: ToolResultFile[];
  /** Turns an attachment path (relative to the report folder) into the path shown in the trace command. */
  tracePath: (reportRelative: string) => string;
  /** Returns a data: URI for an image attachment to embed it, or null to link it by relative path. */
  embed: (attachment: TestAttachment) => string | null;
  warnings: string[];
}

const TOOL_LABEL: Record<string, string> = { jest: "Jest", playwright: "Playwright", vitest: "Vitest" };
const STATUSES: TestStatus[] = ["failed", "flaky", "passed", "skipped"];
const STATUS_LABEL: Record<TestStatus, string> = { failed: "Failed", flaky: "Flaky", passed: "Passed", skipped: "Skipped" };
const RANK: Record<TestStatus, number> = { failed: 0, flaky: 1, passed: 2, skipped: 2 };

// 16px status glyphs (stroke icons, Lucide-style). Colour comes from the status class; the label is in text.
const ICON: Record<TestStatus, string> = {
  passed: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  failed: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  flaky: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 10v4M12 17v.5"/>',
  skipped: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
};
const icon = (s: TestStatus) =>
  `<svg class="ic ${s}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[s]}</svg>`;

export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Encodes each path segment so names with spaces or non-ASCII stay valid relative URLs. */
function url(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "–";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;
}

const toolLabel = (tool: string) => TOOL_LABEL[tool] ?? tool.charAt(0).toUpperCase() + tool.slice(1);
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Playwright names its automatic end-of-test screenshot "screenshot". */
const stepName = (name: string) => (name === "screenshot" ? "Final state" : name);

function sumCounts(list: ToolCounts[]): ToolCounts {
  return list.reduce(
    (a, c) => ({
      total: a.total + c.total,
      passed: a.passed + c.passed,
      failed: a.failed + c.failed,
      skipped: a.skipped + c.skipped,
      flaky: a.flaky + c.flaky,
      durationMs: a.durationMs + c.durationMs,
    }),
    { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, durationMs: 0 },
  );
}

interface Group {
  file: string;
  records: TestRecord[];
}

/** By file; files with failures first, then flaky; inside a file, failures first and otherwise the run order. */
function groupByFile(records: TestRecord[]): Group[] {
  const map = new Map<string, TestRecord[]>();
  for (const r of records) {
    const list = map.get(r.file);
    if (list) list.push(r);
    else map.set(r.file, [r]);
  }
  const groups = [...map.entries()].map(([file, list]) => ({
    file,
    records: list.map((r, j) => ({ r, j })).sort((a, b) => RANK[a.r.status] - RANK[b.r.status] || a.j - b.j).map((x) => x.r),
  }));
  const worst = (g: Group) => Math.min(...g.records.map((r) => RANK[r.status]));
  return groups.map((g, i) => ({ g, i })).sort((a, b) => worst(a.g) - worst(b.g) || a.i - b.i).map((x) => x.g);
}

/** The stack without the message it repeats at the top (Playwright and Jest both prepend it). */
function stackOnly(error: { message: string; stack?: string }): string {
  const stack = error.stack ?? "";
  const rest = stack.startsWith(error.message) ? stack.slice(error.message.length) : stack;
  const lines = rest.split("\n").map((l) => l.replace(/^\s+(?=at )/, "")).filter((l) => l.trim());
  // Frames inside dependencies and Node itself are noise for test authors; keep them only if nothing else is left.
  const internal = (l: string) => /^at /.test(l) && /node_modules[\\/]|\(node:|^at node:/.test(l);
  const own = lines.filter((l) => !internal(l));
  const hidden = lines.length - own.length;
  if (!own.length) return lines.join("\n");
  return own.join("\n") + (hidden ? `\n… ${hidden} frame${hidden > 1 ? "s" : ""} in node_modules / node internals hidden` : "");
}

function quote(p: string): string {
  return /^[\w./@:-]+$/.test(p) ? p : `"${p.replace(/"/g, '\\"')}"`;
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const testId = (r: TestRecord) => `${slug(r.title).slice(0, 24) || "t"}-${hash(r.id)}`;

/** Collects embedded images once; <img> tags point at them by id so one picture is never stored twice. */
class Images {
  readonly map: Record<string, string> = {};
  private ids = new Map<string, string>();
  constructor(private readonly embed: RenderInput["embed"]) {}
  /** data-img="<id>" when embedded, data-url="<relative path>" otherwise. The page script sets src. */
  ref(a: TestAttachment): string {
    let id = this.ids.get(a.path);
    if (id === undefined) {
      const data = this.embed(a);
      id = data ? `i${this.ids.size}` : "";
      if (data) this.map[id] = data;
      this.ids.set(a.path, id);
    }
    return id ? `data-img="${id}"` : `data-url="${esc(url(a.path))}"`;
  }
}

interface Ctx {
  images: Images;
  tracePath: RenderInput["tracePath"];
}

function listItem(r: TestRecord): string {
  const sub = [r.suite, r.project].filter(Boolean).map(esc).join(" · ");
  return `<li><a class="item" href="#/t/${testId(r)}" data-id="${testId(r)}" data-status="${r.status}" data-tool="${esc(r.tool)}" data-text="${esc(
    [r.file, r.suite, r.title, r.project, r.error?.message].filter(Boolean).join(" ").toLowerCase(),
  )}">${icon(r.status)}<span class="sr">${STATUS_LABEL[r.status]}: </span><span class="it"><span class="name">${esc(r.title)}</span>${sub ? `<span class="sub">${sub}</span>` : ""}</span><span class="dur">${formatDuration(r.durationMs)}</span></a></li>`;
}

function detail(r: TestRecord, ctx: Ctx): string {
  const images = r.attachments.filter((a) => a.contentType.startsWith("image/"));
  const traces = r.attachments.filter((a) => a.name === "trace" || a.contentType === "application/zip");
  const videos = r.attachments.filter((a) => a.contentType.startsWith("video/"));
  const crumbs = [toolLabel(r.tool), r.file, r.suite].filter(Boolean).map((c) => `<span>${esc(c)}</span>`).join('<span class="sep">/</span>');
  const meta = [
    `<span class="pill ${r.status}">${icon(r.status)}${STATUS_LABEL[r.status]}</span>`,
    r.project ? `<span>${esc(r.project)}</span>` : "",
    `<span>${formatDuration(r.durationMs)}</span>`,
    r.retries ? `<span>${r.retries} ${r.retries === 1 ? "retry" : "retries"}</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  const blocks: string[] = [];
  if (r.error) {
    const stack = stackOnly(r.error);
    blocks.push(
      `<section class="blk"><h3>Error</h3><pre class="err">${esc(r.error.message)}</pre>${
        stack ? `<details class="stack"><summary>Stack trace</summary><pre>${esc(stack)}</pre></details>` : ""
      }</section>`,
    );
  }
  if (images.length) {
    // Failed tests open on the last screenshot: the screen at the moment of failure.
    const start = r.status === "failed" ? images.length - 1 : 0;
    const steps = images
      .map(
        (a, i) =>
          `<li><button type="button" class="step" ${ctx.images.ref(a)} data-name="${esc(stepName(a.name))}"${i === start ? ' aria-current="step"' : ""}><span class="thumb"><img alt="" loading="lazy"></span><span class="sl"><b>${i + 1}</b> ${esc(stepName(a.name))}</span></button></li>`,
      )
      .join("");
    blocks.push(
      `<section class="blk viewer" data-start="${start}"><h3>Screenshots <span class="count">${images.length} ${images.length === 1 ? "step" : "steps"}</span></h3>
<figure class="stage"><button type="button" class="stage-btn" aria-label="Open full size"><img alt=""></button>
<figcaption><span class="pos"></span><span class="cap"></span><span class="nav"><button type="button" class="prev" aria-label="Previous step"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button><button type="button" class="next" aria-label="Next step"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></span></figcaption></figure>
<ol class="steps">${steps}</ol></section>`,
    );
  }
  for (const t of traces) {
    const cmd = `npx playwright show-trace ${quote(ctx.tracePath(t.path))}`;
    blocks.push(`<section class="blk"><h3>Trace</h3><div class="cmd"><code>${esc(cmd)}</code><button type="button" class="copy" data-copy="${esc(cmd)}">Copy</button></div></section>`);
  }
  for (const v of videos) blocks.push(`<section class="blk"><h3>Video</h3><video controls preload="none" src="${esc(url(v.path))}"></video></section>`);
  if (!blocks.length) blocks.push(`<p class="quiet">${r.status === "skipped" ? "This test was skipped." : "No error and no attachments for this test."}</p>`);

  return `<article class="detail" id="d-${testId(r)}" hidden aria-labelledby="h-${testId(r)}">
<div class="crumbs">${crumbs}</div>
<h2 id="h-${testId(r)}">${esc(r.title)}</h2>
<div class="dmeta">${meta}</div>
${blocks.join("")}
</article>`;
}

export function renderReport(input: RenderInput): string {
  const { summary, files } = input;
  const ctx: Ctx = { images: new Images(input.embed), tracePath: input.tracePath };
  const total = sumCounts(files.map((f) => f.counts));
  const wall = Math.max(0, Date.parse(summary.finishedAt) - Date.parse(summary.startedAt));
  const ok = total.failed === 0;
  // Tools with failures come first so the first thing in the list is what needs attention.
  const ordered = files
    .map((f, i) => ({ f, i }))
    .sort((a, b) => Number(b.f.counts.failed > 0) - Number(a.f.counts.failed > 0) || a.i - b.i)
    .map((x) => x.f);

  const stat = (key: string, label: string, value: string | number, n?: number) =>
    `<div class="stat ${key}${n === 0 ? " zero" : ""}"><b>${value}</b><span>${label}</span></div>`;
  const git = summary.git
    ? `<span>${esc(summary.git.branch)}${summary.git.commit ? ` @ <code>${esc(summary.git.commit)}</code>` : ""}</span>`
    : "";

  const list = ordered
    .map(
      (f) =>
        `<section class="tool" data-tool="${esc(f.tool)}"><h2 class="toolh">${esc(toolLabel(f.tool))}<span>${f.counts.total}</span></h2>${groupByFile(f.records)
          .map((g) => `<div class="file"><h3 class="fileh" title="${esc(g.file)}">${esc(g.file)}</h3><ul>${g.records.map(listItem).join("")}</ul></div>`)
          .join("")}</section>`,
    )
    .join("");
  const details = ordered.flatMap((f) => groupByFile(f.records).flatMap((g) => g.records.map((r) => detail(r, ctx)))).join("");

  const seg = (cls: string, items: { value: string; label: string; n: number }[], label: string) =>
    `<div class="seg ${cls}" role="group" aria-label="${label}">${items
      .map(
        (x, i) =>
          `<button type="button" data-value="${esc(x.value)}" aria-pressed="${i === 0}">${esc(x.label)}<span>${x.n}</span></button>`,
      )
      .join("")}</div>`;
  const statusSeg = seg(
    "by-status",
    [{ value: "all", label: "All", n: total.total }, ...STATUSES.filter((s) => s === "failed" || total[s] > 0).map((s) => ({ value: s, label: STATUS_LABEL[s], n: total[s] }))],
    "Filter by status",
  );
  const toolSeg =
    files.length > 1
      ? seg("by-tool", [{ value: "all", label: "All tools", n: total.total }, ...ordered.map((f) => ({ value: f.tool, label: toolLabel(f.tool), n: f.counts.total }))], "Filter by tool")
      : "";

  const warnings = input.warnings.map((w) => `<p class="notice">${esc(w)}</p>`).join("");
  const imageData = JSON.stringify(ctx.images.map).replace(/</g, "\\u003c");
  const body = files.length
    ? `<div class="controls"><div class="wrap"><input class="search" type="search" placeholder="Search tests" aria-label="Search tests"><div class="segs">${statusSeg}${toolSeg}</div></div></div>
<nav class="list wrap" aria-label="Tests">${list}<p class="none" hidden>No tests match.</p></nav>`
    : `<p class="notice wrap">No results found. Run your tests with the testkit reporters first.</p>`;
  const chevron = (d: string) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.title)}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="listview">
<header class="top wrap">
<div class="head"><div><h1>${esc(input.title)}</h1><p class="meta"><span>Run <time data-time="${esc(summary.finishedAt)}">${esc(summary.finishedAt)}</time></span>${git}</p></div>
<span class="verdict ${ok ? "ok" : "bad"}">${icon(ok ? "passed" : "failed")}${ok ? "All tests passed" : `${total.failed} failed`}</span></div>
<div class="stats">${stat("total", "Total", total.total)}${stat("passed", "Passed", total.passed, total.passed)}${stat("failed", "Failed", total.failed, total.failed)}${stat("flaky", "Flaky", total.flaky, total.flaky)}${stat("skipped", "Skipped", total.skipped, total.skipped)}${stat("time", "Duration", formatDuration(wall || total.durationMs))}</div>
${warnings}
</header>
${body}
</div>
<main class="detailview" id="detail" tabindex="-1" hidden>
<div class="dbar"><div class="wrap"><a class="back" href="#/">${chevron("m15 6-6 6 6 6")}All tests</a><span class="dpos"></span><span class="dnav"><a class="dprev" href="#/" aria-label="Previous test">${chevron("m15 6-6 6 6 6")}<span>Prev</span></a><a class="dnext" href="#/" aria-label="Next test"><span>Next</span>${chevron("m9 6 6 6-6 6")}</a></span></div></div>
<div class="wrap">${details}</div>
</main>
<dialog class="lb" aria-label="Screenshot"><div class="lb-bar"><span class="lb-cap"></span><button type="button" class="lb-close">Close</button></div><div class="lb-body"><img alt=""></div></dialog>
<script type="application/json" id="testkit-images">${imageData}</script>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}
