window.SenxCore = (() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[c]);
  const initials = name => String(name).trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const formatDate = date => { const parts = date.split('-'); return `${parts[2]}/${parts[1]}/${parts[0]}`; };
  const duration = seconds => `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${(seconds % 60).toString().padStart(2,'0')}`;
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const search = (value, query) => normalize(value).includes(normalize(query));
  const filterCalls = (calls, filters = {}) => calls.filter(c =>
    search(`${c.client} ${c.phone} ${c.id} ${c.agent} ${c.summary || ''}`, filters.query || '') &&
    (!filters.team || c.team === filters.team) && (!filters.status || c.status === filters.status) &&
    (!filters.date || c.date === filters.date));
  const paginate = (items, page = 1, size = 8) => {
    const pages = Math.max(1, Math.ceil(items.length / size));
    const current = Math.min(Math.max(1, page), pages);
    return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
  };
  // Mitiga execução de fórmulas quando o CSV é aberto em uma planilha.
  const csvCell = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const toCsv = rows => '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  return { escapeHtml, initials, formatDate, duration, search, filterCalls, paginate, toCsv };
})();
