import { paise2inr, fmtDate, STATUS_COLOR, STATUS_BG, STATUS_ICON } from '../utils/format'

export function Badge({ status }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      letterSpacing: 0.3, textTransform: 'uppercase',
      color: STATUS_COLOR[status], background: STATUS_BG[status],
      fontFamily: 'Syne, sans-serif',
    }}>
      <span>{STATUS_ICON[status]}</span> {status}
    </span>
  )
}

const TH = ({ children }) => (
  <th style={{
    padding: '10px 16px', textAlign: 'left', fontSize: 11,
    letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase',
    fontWeight: 600, fontFamily: 'Syne, sans-serif', whiteSpace: 'nowrap',
    background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
  }}>{children}</th>
)

export default function PayoutTable({ payouts, showMerchant = false }) {
  if (!payouts.length) return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '4rem 2rem', textAlign: 'center',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <p style={{ fontSize: 36, marginBottom: 10 }}>💸</p>
      <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No payouts yet</p>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>Withdrawal history will appear here</p>
    </div>
  )

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: 0.5, fontFamily: 'Syne, sans-serif' }}>
          Payout History
        </span>
        <span style={{ fontSize: 11, background: 'var(--surface2)', color: 'var(--muted)', padding: '2px 10px', borderRadius: 99, border: '1px solid var(--border)', fontFamily: 'IBM Plex Mono, monospace' }}>
          {payouts.length}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <TH>ID</TH>
              {showMerchant && <TH>Merchant</TH>}
              <TH>Amount</TH>
              <TH>Bank</TH>
              <TH>Status</TH>
              <TH>Created</TH>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p, i) => (
              <tr key={p.id}
                style={{ borderBottom: i < payouts.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 16px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                  {String(p.id).slice(0, 8)}…
                </td>
                {showMerchant && (
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                    {p.merchant_name}
                  </td>
                )}
                <td style={{ padding: '12px 16px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
                  {paise2inr(p.amount_paise)}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                  ••••{p.bank_account_last4}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge status={p.status} />
                  {p.failure_reason && (
                    <p style={{ fontSize: 10, color: 'var(--danger)', marginTop: 3, fontFamily: 'IBM Plex Mono, monospace' }}>
                      {p.failure_reason}
                    </p>
                  )}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
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
