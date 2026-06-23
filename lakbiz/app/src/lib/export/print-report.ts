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
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; color: #0f172a; margin: 24px; }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    th { background: #f8fafc; font-weight: 700; }
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
