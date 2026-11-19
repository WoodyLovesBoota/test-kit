// Minimal / Swiss, light only. Slate neutrals, one colour per status, structure from spacing and
// background steps rather than borders. One scroll: the page. No inner scroll areas.
// System fonts only (the report must open offline).
export const STYLES = `
:root{color-scheme:light;
--bg:#f5f7fa;--panel:#ffffff;--sunken:#f1f5f9;--stage:#e9eef4;--text:#0f172a;--text-2:#334155;--muted:#64748b;
--hover:#eef2f7;--line:#e2e8f0;--focus:#2563eb;
--pass:#15803d;--pass-soft:#ecfdf3;--fail:#dc2626;--fail-soft:#fef2f2;--flaky:#b45309;--flaky-soft:#fffbeb;--skip:#64748b;
--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;
--mono:ui-monospace,"SF Mono",SFMono-Regular,"JetBrains Mono",Menlo,Consolas,monospace}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;cursor:pointer}
code,pre{font-family:var(--mono)}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap{max-width:1040px;margin:0 auto;padding-left:24px;padding-right:24px}
.ic{flex:none}.ic.passed{color:var(--pass)}.ic.failed{color:var(--fail)}.ic.flaky{color:var(--flaky)}.ic.skipped{color:var(--skip)}

/* ---------- List view ---------- */
.top{padding-top:32px;padding-bottom:16px}
.head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px 24px;margin-bottom:20px}
h1{margin:0;font-size:22px;line-height:1.3;font-weight:650;letter-spacing:-.01em}
.meta{display:flex;flex-wrap:wrap;gap:4px 16px;margin:4px 0 0;color:var(--muted);font-size:13px}
.meta code{font-size:12px}
.verdict{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-weight:600;font-size:13px}
.verdict.ok{background:var(--pass-soft);color:var(--pass)}.verdict.bad{background:var(--fail-soft);color:var(--fail)}
.stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.stat{background:var(--panel);border-radius:12px;padding:14px 16px}
.stat b{display:block;font-size:24px;line-height:1.15;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.stat span{color:var(--muted);font-size:12px}
.stat.passed b{color:var(--pass)}.stat.failed b{color:var(--fail)}.stat.flaky b{color:var(--flaky)}.stat.zero b{color:var(--muted)}
.notice{margin:12px 0 0;padding:10px 14px;border-radius:10px;background:var(--flaky-soft);color:var(--text-2);font-size:13px}

/* Filters stay at the top of the screen while the page scrolls. */
.controls{position:sticky;top:0;z-index:5;background:rgba(245,247,250,.94);backdrop-filter:saturate(1.4) blur(8px);-webkit-backdrop-filter:saturate(1.4) blur(8px)}
.controls .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding-top:12px;padding-bottom:12px}
.search{flex:1 1 240px;min-width:0;height:40px;border:0;border-radius:10px;background:var(--panel);color:var(--text);padding:0 14px;font:inherit;font-size:14px}
.search::placeholder{color:var(--muted)}
.segs{display:flex;flex-wrap:wrap;gap:8px 16px}
.seg{display:flex;gap:2px;background:var(--sunken);border-radius:10px;padding:3px}
.seg button{border:0;background:transparent;color:var(--muted);border-radius:8px;padding:5px 10px;min-height:34px;font-size:13px;transition:background-color .15s,color .15s}
.seg button span{margin-left:6px;font-variant-numeric:tabular-nums;opacity:.8}
.seg button:hover{color:var(--text)}
.seg button[aria-pressed=true]{background:var(--panel);color:var(--text);font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.08)}
.by-status button[data-value=failed] span{color:var(--fail);opacity:1}

.list{padding-bottom:48px}
.tool{margin-top:24px}
.toolh{display:flex;align-items:baseline;gap:8px;margin:0 0 8px;font-size:12px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--text-2)}
.toolh span{color:var(--muted);font-weight:500;letter-spacing:0}
.file{background:var(--panel);border-radius:14px;padding:6px;margin-bottom:10px}
.fileh{margin:0;padding:10px 12px 6px;font:500 12.5px/1.4 var(--mono);color:var(--muted);overflow-wrap:anywhere}
.list ul{list-style:none;margin:0;padding:0}
.item{display:grid;grid-template-columns:16px minmax(0,1fr) auto;gap:12px;align-items:start;padding:10px 12px;min-height:44px;border-radius:10px;transition:background-color .15s}
.item .ic{margin-top:3px}
.item:hover{background:var(--hover)}
.it{min-width:0;display:grid;gap:2px}
.name{word-break:keep-all;overflow-wrap:anywhere}
.item[data-status=failed] .name,.item[data-status=flaky] .name{font-weight:600}
.sub{font-size:12.5px;color:var(--muted)}
.dur{font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;margin-top:2px}
.none{color:var(--muted);padding:32px 0;text-align:center}

/* ---------- Detail view ---------- */
.detailview:focus{outline:none}
.dbar{position:sticky;top:0;z-index:5;background:rgba(245,247,250,.94);backdrop-filter:saturate(1.4) blur(8px);-webkit-backdrop-filter:saturate(1.4) blur(8px)}
.dbar .wrap{display:flex;align-items:center;gap:12px;min-height:56px}
.back,.dnav a{display:inline-flex;align-items:center;gap:4px;min-height:40px;padding:0 10px;border-radius:8px;font-size:14px;font-weight:600;color:var(--text-2)}
.back{margin-left:-10px}
.back:hover,.dnav a:hover{background:var(--hover)}
.dpos{margin-left:auto;color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}
.dnav{display:flex;gap:2px}
.dnav a[aria-disabled=true]{opacity:.35;pointer-events:none}
.detail{background:var(--panel);border-radius:16px;padding:28px 32px 36px;margin:8px 0 48px}
.crumbs{display:flex;flex-wrap:wrap;gap:2px 6px;font:12.5px/1.5 var(--mono);color:var(--muted);margin-bottom:8px}
.crumbs .sep{opacity:.5}
.detail h2{margin:0;font-size:22px;line-height:1.35;font-weight:650;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.dmeta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:12px;color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 8px;border-radius:999px;font-weight:600;font-size:12.5px}
.pill.passed{background:var(--pass-soft);color:var(--pass)}.pill.failed{background:var(--fail-soft);color:var(--fail)}
.pill.flaky{background:var(--flaky-soft);color:var(--flaky)}.pill.skipped{background:var(--sunken);color:var(--skip)}
.pill .ic{color:currentColor}
.blk{margin-top:32px}
.blk h3{display:flex;align-items:baseline;gap:8px;margin:0 0 12px;font-size:12px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--text-2)}
.blk h3 .count{color:var(--muted);font-weight:500;letter-spacing:0;text-transform:none}
/* Error and stack wrap instead of scrolling. */
.err{margin:0;padding:16px 18px;border-radius:12px;background:var(--fail-soft);color:var(--text);font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}
.stack{margin-top:8px}
.stack summary{color:var(--muted);font-size:13px;padding:6px 0;cursor:pointer;width:max-content}
.stack pre{margin:6px 0 0;padding:14px 18px;border-radius:12px;background:var(--sunken);font-size:12.5px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text-2)}
.quiet{color:var(--muted);margin-top:28px}

/* Screenshot viewer: one large image + a wrapping row of step thumbnails. */
.stage{margin:0;background:var(--stage);border-radius:14px;overflow:hidden}
.stage-btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:160px;padding:20px;border:0;background:transparent;cursor:zoom-in}
.stage-btn img{display:block;max-width:100%;max-height:72vh;width:auto;height:auto;border-radius:8px;box-shadow:0 1px 3px rgba(15,23,42,.12),0 10px 30px rgba(15,23,42,.10)}
.stage figcaption{display:flex;align-items:center;gap:12px;padding:8px 8px 8px 18px;background:var(--sunken);font-size:13.5px}
.stage .pos{color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.stage .cap{flex:1;min-width:0;font-weight:600;overflow-wrap:anywhere}
.stage .nav{display:flex;gap:4px}
.stage .nav button{display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:8px;background:transparent;color:var(--text-2)}
.stage .nav button:hover{background:var(--hover)}
.stage .nav button:disabled{opacity:.35;cursor:default;background:transparent}
.steps{list-style:none;display:flex;flex-wrap:wrap;gap:12px;margin:14px 0 0;padding:0}
.steps>li{flex:0 0 150px;min-width:0}
.step{display:grid;gap:6px;width:100%;border:0;background:transparent;padding:0;text-align:left;color:var(--muted)}
.step .thumb{display:block;height:88px;border-radius:8px;overflow:hidden;background:var(--stage);outline:2px solid transparent;outline-offset:2px;transition:outline-color .15s}
.step img{display:block;width:100%;height:100%;object-fit:contain}
.step .sl{font-size:12.5px;line-height:1.35;overflow-wrap:anywhere}
.step .sl b{color:var(--text-2);margin-right:2px;font-variant-numeric:tabular-nums}
.step:hover .thumb{outline-color:var(--line)}
.step[aria-current=step]{color:var(--text)}
.step[aria-current=step] .thumb{outline-color:var(--text)}
/* Trace command wraps rather than scrolling sideways. */
.cmd{display:flex;gap:8px;align-items:flex-start;background:var(--sunken);border-radius:12px;padding:8px 8px 8px 16px}
.cmd code{flex:1;min-width:0;font-size:12.5px;line-height:1.6;padding:6px 0;white-space:pre-wrap;overflow-wrap:anywhere}
.copy{flex:none;border:0;border-radius:8px;background:var(--panel);padding:8px 14px;font-size:13px;font-weight:600;min-height:36px;box-shadow:0 1px 2px rgba(15,23,42,.08)}
.copy:hover{background:var(--hover)}
video{max-width:100%;border-radius:12px}

/* Full-size viewer: the image fits the screen, nothing scrolls. */
dialog.lb{border:0;padding:0;margin:0;width:100vw;height:100vh;max-width:100vw;max-height:100vh;background:rgba(15,23,42,.92);color:#f8fafc;overflow:hidden}
dialog.lb::backdrop{background:rgba(15,23,42,.5)}
.lb-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;height:56px;padding:0 16px;font-size:13.5px}
.lb-close{border:0;border-radius:8px;background:rgba(248,250,252,.14);color:#f8fafc;padding:8px 14px;min-height:40px}
.lb-body{display:flex;align-items:center;justify-content:center;height:calc(100vh - 56px);padding:0 16px 16px}
.lb-body img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px}

@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@media (max-width:900px){.stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:640px){
.wrap{padding-left:16px;padding-right:16px}
.top{padding-top:20px}
h1{font-size:20px}
.stat{padding:12px}
.stat b{font-size:20px}
.segs{gap:8px}
.detail{border-radius:0;margin:0 -16px 32px;padding:20px 16px 28px}
.detail h2{font-size:19px}
.stage-btn{padding:10px}
.stage-btn img{max-height:68vh}
.steps{gap:10px}.steps>li{flex-basis:calc((100% - 20px) / 3)}.step .thumb{height:auto;aspect-ratio:4/3}
.dnav span{display:none}
}
@media print{.controls,.dbar,.copy,dialog{display:none!important}}
`;
