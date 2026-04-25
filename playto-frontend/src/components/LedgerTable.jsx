import { paise2inr, fmtDate } from '../utils/format'

export default function LedgerTable({ entries }) {
  if (!entries.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontWeight: 700, fontSize: 14, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase' }}>LEDGER</h3>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Type', 'Amount', 'Description', 'Date'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: 11, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '0.85rem 1.25rem' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                    color: e.entry_type === 'credit' ? 'var(--accent)' : 'var(--danger)' }}>
                    {e.entry_type}
                  </span>
                </td>
                <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600,
                  color: e.amount_paise > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                  {e.amount_paise > 0 ? '+' : ''}{paise2inr(Math.abs(e.amount_paise))}
                </td>
                <td style={{ padding: '0.85rem 1.25rem', fontSize: 13, color: 'var(--muted)' }}>{e.description}</td>
                <td style={{ padding: '0.85rem 1.25rem', fontSize: 12, color: 'var(--muted)' }}>{fmtDate(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
