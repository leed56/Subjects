type PrintReportOptions = {
  title: string;
  subtitle?: string;
  shopName: string;
  generatedAt?: Date;
  bodyHtml: string;
};

export function printHtmlReport(options: PrintReportOptions): void {
  const generated =
    options.generatedAt ?? new Date();
  // A noopener feature can make Chrome return `null` even when the popup
  // opens, which leaves the new tab blank because it cannot be written.
  // Open the same-origin document first, then sever the opener immediately.
  const win = window.open("", "_blank");
  if (!win) return;
  win.opener = null;

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; color: #0f172a; margin: 24px; }
    h1 { font-size: 1.55rem; letter-spacing: -0.025em; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 0.8rem; margin-bottom: 18px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(125px, 1fr)); gap: 8px; margin: 0 0 18px; }
    .summary-card { border: 1px solid #dbe5ec; border-radius: 9px; padding: 10px 12px; break-inside: avoid; }
    .summary-label { color: #64748b; font-size: 0.68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .summary-value { font-size: 1.05rem; font-weight: 750; margin-top: 4px; }
    .summary-hint { color: #64748b; font-size: 0.68rem; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    th { background: #eaf7f7; color: #0f5960; font-size: .7rem; letter-spacing: .04em; text-transform: uppercase; font-weight: 750; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    tfoot td { font-weight: 700; background: #f8fafc; }
    @media print {
      body { margin: 12px; }
      @page { margin: 12mm; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(options.title)}</h1>
  <p class="meta">
    ${escapeHtml(options.shopName)}
    ${options.subtitle ? ` · ${escapeHtml(options.subtitle)}` : ""}
    · ${generated.toLocaleString("en-LK")}
  </p>
  ${options.bodyHtml}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
  win.document.close();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function tableHtml(
  headers: string[],
  rows: (string | number)[][],
  numericCols?: number[],
): string {
  const head = headers
    .map((h, i) => {
      const cls = numericCols?.includes(i) ? ' class="num"' : "";
      return `<th${cls}>${escapeHtml(h)}</th>`;
    })
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, i) => {
            const cls = numericCols?.includes(i) ? ' class="num"' : "";
            return `<td${cls}>${escapeHtml(String(cell))}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function reportSummaryHtml(items: Array<{ label: string; value: string | number; hint?: string }>): string {
  return `<section class="summary">${items.map((item) => `<div class="summary-card"><div class="summary-label">${escapeHtml(item.label)}</div><div class="summary-value">${escapeHtml(String(item.value))}</div>${item.hint ? `<div class="summary-hint">${escapeHtml(item.hint)}</div>` : ""}</div>`).join("")}</section>`;
}
