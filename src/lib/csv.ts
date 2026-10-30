/** Quote CSV fields and prevent spreadsheet formulas after whitespace/control prefixes. */
export function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}
