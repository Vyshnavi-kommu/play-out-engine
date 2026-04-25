export const paise2inr = (p) =>
  (p / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })

export const fmtDate = (d) =>
  new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export const STATUS_COLOR = {
  pending: '#ffb830',
  processing: '#7c6aff',
  completed: '#00e5a0',
  failed: '#ff4d6d',
}
