import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { api } from '../utils/api'
import { paise2inr } from '../utils/format'

export default function PayoutForm({ merchant, onSuccess }) {
  const [amountRs, setAmountRs] = useState('')
  const [bankAccountId] = useState(merchant.bank_accounts[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)

  const availablePaise = merchant.available_balance_paise
  const amountPaise    = Math.round(parseFloat(amountRs || 0) * 100)
  const exceedsBalance = amountPaise > availablePaise
  const primaryAccount = merchant.bank_accounts.find(b => b.is_primary) || merchant.bank_accounts[0]

  async function submit() {
    setErr(null); setOk(null)
    if (amountPaise <= 0) { setErr('Enter a valid amount'); return }
    if (exceedsBalance)   { setErr(`Exceeds available balance`); return }
    setLoading(true)
    try {
      const payout = await api.createPayout(
        merchant.id,
        { amount_paise: amountPaise, bank_account_id: bankAccountId },
        uuidv4()
      )
      setOk(`Payout ${String(payout.id).slice(0, 8)}… queued`)
      setAmountRs('')
      onSuccess()
    } catch (e) {
      setErr(e.error || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '1.5rem', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)', position: 'sticky', top: 80 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 36, height: 36, background: 'var(--accent-light)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          ↑
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text)' }}>Request Payout</h3>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>Withdraw to your bank account</p>
        </div>
      </div>

      {/* Amount */}
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Amount (₹)</label>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 700, fontSize: 16 }}>₹</span>
        <input
          type="number" min="1" step="0.01"
          value={amountRs}
          onChange={e => { setAmountRs(e.target.value); setErr(null); setOk(null) }}
          placeholder="0.00"
          style={{
            width: '100%', background: exceedsBalance ? 'var(--danger-light)' : 'var(--surface2)',
            border: `1.5px solid ${exceedsBalance ? 'var(--danger)' : 'var(--border2)'}`,
            borderRadius: 12, padding: '0.8rem 1rem 0.8rem 2.5rem',
            color: 'var(--text)', fontSize: 22, fontFamily: 'IBM Plex Mono, monospace',
            fontWeight: 700, outline: 'none', transition: 'all 0.15s',
          }}
          onFocus={e => { if (!exceedsBalance) e.target.style.borderColor = 'var(--accent)' }}
          onBlur={e => { e.target.style.borderColor = exceedsBalance ? 'var(--danger)' : 'var(--border2)' }}
        />
      </div>

      {/* Balance hint */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Available balance</span>
        <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: exceedsBalance ? 'var(--danger)' : 'var(--accent)' }}>
          {paise2inr(availablePaise)}
        </span>
      </div>

      {/* Bank account */}
      {primaryAccount && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>To Bank</p>
            <p style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text)', fontWeight: 500 }}>
              {primaryAccount.account_holder} — ••••{primaryAccount.account_number.slice(-4)}
            </p>
          </div>
          <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-light)', padding: '3px 8px', borderRadius: 99, fontWeight: 700, letterSpacing: 0.5 }}>PRIMARY</span>
        </div>
      )}

      {/* Feedback */}
      {err && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'var(--danger)', fontSize: 16 }}>⚠</span>
          <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>
        </div>
      )}
      {ok && (
        <div style={{ background: 'var(--accent-light)', border: '1px solid #6ee7b7', borderRadius: 10, padding: '10px 14px', marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'var(--accent)', fontSize: 16 }}>✓</span>
          <p style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}>{ok}</p>
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading || exceedsBalance}
        style={{
          width: '100%', background: loading || exceedsBalance ? 'var(--border2)' : 'var(--accent)',
          color: loading || exceedsBalance ? 'var(--muted)' : '#fff',
          border: 'none', borderRadius: 12, padding: '0.85rem',
          fontWeight: 700, fontSize: 13, letterSpacing: 1.5,
          cursor: loading || exceedsBalance ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s', fontFamily: 'Syne, sans-serif',
          boxShadow: loading || exceedsBalance ? 'none' : '0 4px 12px rgba(5,150,105,0.3)',
        }}
        onMouseEnter={e => { if (!loading && !exceedsBalance) e.target.style.background = '#047857' }}
        onMouseLeave={e => { if (!loading && !exceedsBalance) e.target.style.background = 'var(--accent)' }}
      >
        {loading ? 'PROCESSING…' : 'WITHDRAW FUNDS'}
      </button>
    </div>
  )
}
