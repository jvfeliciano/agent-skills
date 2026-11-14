export interface SlopHit {
  file: string;
  line: number;
  rule: string;
  match: string;
}

export const SLOP_RULES: Array<[string, RegExp]> = [
  ['chatbot-filler', /\b(here is|here's a breakdown|hope this helps|let me know if|happy to help|feel free to|certainly!|absolutely!)\b/i],
  ['ai-puffery', /\b(delve into|testament to|pivotal moment|tapestry of|game[- ]changer|unlock the power|it's important to note|it is worth noting|in today's fast[- ]paced|in conclusion)\b/i],
  ['symmetrical-cliche', /\bnot only\b.{1,80}\bbut also\b/i],
];

/** Strip inline backtick spans so code tokens do not trigger prose rules. */
function stripInlineCode(line: string): string {
  return line.replace(/`+[^`]*`+/g, '');
}

/** Scan Markdown content for AI slop tells while ignoring code blocks and inline code. */
export function scanUnslop(content: string, filePath: string): SlopHit[] {
  const hits: SlopHit[] = [];
  const lines = content.split('\n');
  let fenceChar: string | null = null;
  let proseLines = 0;
  let proseEmDashLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const fenceMatch = /^\s*(```+|~~~+)/.exec(raw);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fenceChar) fenceChar = marker;
      else if (fenceChar === marker) fenceChar = null;
      continue;
    }
    if (fenceChar) continue;

    const prose = stripInlineCode(raw);
    if (prose.trim()) proseLines++;

    for (const [rule, rx] of SLOP_RULES) {
      const m = rx.exec(prose);
      if (m) hits.push({ file: filePath, line: i + 1, rule, match: m[0] });
    }

    const isTableRow = /^\s*\|/.test(raw);
    if (!isTableRow && prose.includes('—')) {
      proseEmDashLines++;
    }
  }

  const emLimit = Math.max(2, Math.floor(proseLines / 25));
  if (proseEmDashLines > emLimit) {
    hits.push({
      file: filePath,
      line: 1,
      rule: 'excessive-em-dash',
      match: `${proseEmDashLines} prose lines with em-dash (limit ${emLimit})`,
    });
  }

  return hits;
}
