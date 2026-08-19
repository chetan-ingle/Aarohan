export const sendCsv = (res, filename, headers, rows) => {
  const clean = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const body = [headers.map((x) => clean(x.label)).join(','), ...rows.map((row) => headers.map((x) => clean(x.value(row))).join(','))].join('\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` }).send(body);
};
