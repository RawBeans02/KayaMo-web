export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell);
      cell = '';
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      if (ch === '\r') i += 1;
      continue;
    }
    if (ch === '\r') {
      row.push(cell);
      cell = '';
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  const header = rows[0];
  if (!header) return [];
  return rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      const rawKey = header[i] ?? '';
      const key = rawKey.replace(/^\uFEFF/, '').trim();
      if (key) record[key] = (values[i] ?? '').trim();
    }
    return record;
  });
}

export function toCsv(headers: string[], records: Array<Record<string, string | number | boolean | null>>): string {
  const escape = (value: string) => {
    if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
    return value;
  };
  const lines = [headers.join(',')];
  for (const record of records) {
    lines.push(
      headers
        .map((key) => {
          const value = record[key];
          if (value === null || value === undefined) return '';
          return escape(String(value));
        })
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
