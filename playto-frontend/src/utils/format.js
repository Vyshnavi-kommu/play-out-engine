export const paise2inr = (p) =>
  (p / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })

export const fmtDate = (d) =>
  new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export const STATUS_COLOR = {
  pending:    '#d97706',
  processing: '#7c3aed',
  completed:  '#059669',
  failed:     '#dc2626',
}

export const STATUS_BG = {
  pending:    '#fffbeb',
  processing: '#f5f3ff',
  completed:  '#ecfdf5',
  failed:     '#fef2f2',
}

export const STATUS_ICON = {
  pending:    '◐',
  processing: '⟳',
  completed:  '✓',
  failed:     '✗',
}
