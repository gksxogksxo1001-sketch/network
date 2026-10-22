const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const mdPath = path.join(__dirname, '네트워크관리사2급_기출문제_해설.md');
const htmlPath = path.join(__dirname, '네트워크관리사2급_기출문제_해설.html');
const pdfPath = path.join(__dirname, '네트워크관리사2급_기출문제_해설.pdf');

const md = fs.readFileSync(mdPath, 'utf8');

function formatInline(str) {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\`(.*?)\`/g, '<code>$1</code>')
    .replace(/\$([^$]+)\$/g, '<em>$1</em>');
}

function parseMarkdown(content) {
  const lines = content.split('\n');
  const html = [];
  let inTable = false;
  let tableHeaderDone = false;
  let inQuestion = false;

  for (let line of lines) {
    const trimmed = line.trim();

    // Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        tableHeaderDone = true;
        continue;
      }
      if (!inTable) {
        html.push('<table><tbody>');
        inTable = true;
        tableHeaderDone = false;
      }
      const tag = !tableHeaderDone ? 'th' : 'td';
      html.push('<tr>' + cells.map(c => `<${tag}>${formatInline(c)}</${tag}>`).join('') + '</tr>');
      continue;
    } else if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
      tableHeaderDone = false;
    }

    if (trimmed.startsWith('# ')) {
      if (inQuestion) { html.push('</div>'); inQuestion = false; }
      html.push(`<h1 class='title'>${formatInline(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      if (inQuestion) { html.push('</div>'); inQuestion = false; }
      html.push(`<h2 class='section-title'>${formatInline(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      if (inQuestion) { html.push('</div>'); }
      html.push(`<div class='question-box'><h3 class='q-title'>${formatInline(trimmed.slice(4))}</h3>`);
      inQuestion = true;
    } else if (trimmed === '---') {
      if (inQuestion) { html.push('</div>'); inQuestion = false; }
    } else if (trimmed.startsWith('> ')) {
      html.push(`<div class='callout'>${formatInline(trimmed.slice(2))}</div>`);
    } else if (trimmed.startsWith('- ')) {
      html.push(`<li>${formatInline(trimmed.slice(2))}</li>`);
    } else if (trimmed.length > 0) {
      html.push(`<p>${formatInline(trimmed)}</p>`);
    }
  }
  if (inTable) html.push('</tbody></table>');
  if (inQuestion) html.push('</div>');
  return html.join('\n');
}

const bodyHtml = parseMarkdown(md);

const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>네트워크관리사 2급 필기 기출문제 해설서</title>
<style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
  @page {
    size: A4;
    margin: 15mm 12mm 15mm 12mm;
  }
  body {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #1e293b;
    font-size: 13px;
    background: #ffffff;
    margin: 0;
    padding: 0;
  }
  h1.title {
    font-size: 22px;
    font-weight: 800;
    color: #1e3a8a;
    border-bottom: 2.5px solid #2563eb;
    padding-bottom: 8px;
    margin-top: 5px;
    margin-bottom: 14px;
    text-align: center;
  }
  h2.section-title {
    font-size: 16px;
    font-weight: 700;
    color: #1e3a8a;
    background: #eff6ff;
    padding: 7px 12px;
    border-left: 4px solid #2563eb;
    border-radius: 4px;
    margin-top: 18px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }
  .callout {
    background: #f8fafc;
    border-left: 3.5px solid #0284c7;
    padding: 8px 12px;
    border-radius: 4px;
    margin-bottom: 12px;
    color: #334155;
    font-size: 12px;
  }
  .question-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 10px;
    page-break-inside: avoid;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  }
  .q-title {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 6px 0;
  }
  p {
    margin: 4px 0;
  }
  strong {
    color: #1d4ed8;
    font-weight: 700;
  }
  code {
    background: #f1f5f9;
    padding: 1px 5px;
    border-radius: 3px;
    color: #ea580c;
    font-size: 12px;
    font-family: Consolas, monospace;
  }
  ul, li {
    margin: 3px 0;
  }
  li {
    margin-left: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 16px 0;
    font-size: 11.5px;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 6px;
    text-align: center;
  }
  th {
    background: #2563eb;
    color: #ffffff;
    font-weight: 600;
  }
  tr:nth-child(even) {
    background: #f8fafc;
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

fs.writeFileSync(htmlPath, fullHtml, 'utf8');
console.log('HTML saved:', htmlPath);

// Chrome / Edge headless print to PDF
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const browserExe = fs.existsSync(chromePath) ? chromePath : edgePath;

const cmd = `"${browserExe}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${pdfPath}" "${htmlPath}"`;
console.log('Running PDF export...');
try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('PDF export completed successfully:', pdfPath);
} catch (e) {
  console.error('Failed to export PDF:', e.message);
}
