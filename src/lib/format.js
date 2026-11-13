export const naira = (kobo, { decimals = 2 } = {}) =>
  kobo == null
    ? '—'
    : '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// ₦1.2m / ₦450k, for tight spaces like chart labels
export const nairaShort = (kobo) => {
  const n = (kobo || 0) / 100;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}k`;
  return `₦${Math.round(n)}`;
};

export const date = (d) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

export const monthLabel = (period) => {
  if (!period) return '';
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
};

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
