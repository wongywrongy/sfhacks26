// Formatting helpers used across the app and the Deal memo PDF.

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatDate(d, opts = {}) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const month = MONTH_NAMES[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  if (opts.short) return `${month} ${day}`;
  return `${month} ${day}, ${year}`;
}

export function formatDateTime(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const base = formatDate(date);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${base} ${hours}:${minutes} ${ampm}`;
}

export function formatCurrency(n, { cents = false } = {}) {
  if (n == null || isNaN(n)) return '—';
  const negative = n < 0;
  const abs = Math.abs(n);
  const value = cents
    ? abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(abs).toLocaleString();
  return `${negative ? '-' : ''}$${value}`;
}

export function formatPercent(v, digits = 1) {
  if (v == null || isNaN(v)) return '—';
  return (v * 100).toFixed(digits) + '%';
}
