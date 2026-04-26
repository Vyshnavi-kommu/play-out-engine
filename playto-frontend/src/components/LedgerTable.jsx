import { paise2inr, fmtDate } from '../utils/format'

const TH = ({ children }) => (
  <th style={{
    padding: '10px 16px', textAlign: 'left', fontSize: 11,
    letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase',
    fontWeight: 600, fontFamily: 'Syne, sans-serif',
    background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
  }}>{children}</th>
)

export default function LedgerTable({ entries }) {
  if (!entries.length) return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '4rem', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
    }}>
      <p style={{ fontSize: 36, marginBottom: 10 }}>📒</p>
      <p style={{ fontWeight: 600, color: 'var(--text)' }}>No ledger entries</p>
    </div>
  )

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: 0.5, fontFamily: 'Syne, sans-serif' }}>
          Ledger Entries
        </span>
        <span style={{ fontSize: 11, background: 'var(--surface2)', color: 'var(--muted)', padding: '2px 10px', borderRadius: 99, border: '1px solid var(--border)', fontFamily: 'IBM Plex Mono, monospace' }}>
          {entries.length}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <TH>Type</TH>
              <TH>Amount</TH>
              <TH>Description</TH>
              <TH>Date</TH>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const isCredit = e.amount_paise > 0
              const color = isCredit ? 'var(--accent)' : 'var(--danger)'
              const bg    = isCredit ? 'var(--accent-light)' : 'var(--danger-light)'
              return (
                <tr key={e.id}
                  style={{ borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={el => el.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={el => el.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color, background: bg, padding: '3px 10px', borderRadius: 99, fontFamily: 'Syne, sans-serif' }}>
                      {isCredit ? '↑' : '↓'} {e.entry_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color, fontSize: 14 }}>
                    {isCredit ? '+' : ''}{paise2inr(Math.abs(e.amount_paise))}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.description}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {fmtDate(e.created_at)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
