import { paise2inr, fmtDate, STATUS_COLOR } from '../utils/format'

function Badge({ status }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
      color: STATUS_COLOR[status], border: `1px solid ${STATUS_COLOR[status]}22`,
      background: `${STATUS_COLOR[status]}18`
    }}>{status}</span>
  )
}

export default function PayoutTable({ payouts }) {
  if (!payouts.length) return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
      No payouts yet
    </div>
  )

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontWeight: 700, fontSize: 14, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase' }}>PAYOUT HISTORY</h3>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ID', 'Amount', 'Bank', 'Status', 'Created'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: 11, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payouts.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < payouts.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '1rem 1.25rem', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                  {String(p.id).slice(0, 8)}…
                </td>
                <td style={{ padding: '1rem 1.25rem', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, color: 'var(--text)' }}>
                  {paise2inr(p.amount_paise)}
                </td>
                <td style={{ padding: '1rem 1.25rem', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                  ••••{p.bank_account_last4}
                </td>
                <td style={{ padding: '1rem 1.25rem' }}>
                  <Badge status={p.status} />
                  {p.failure_reason && (
                    <p style={{ fontSize: 10, color: 'var(--danger)', marginTop: 3 }}>{p.failure_reason}</p>
                  )}
                </td>
                <td style={{ padding: '1rem 1.25rem', fontSize: 12, color: 'var(--muted)' }}>
                  {fmtDate(p.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
