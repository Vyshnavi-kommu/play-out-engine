import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { api } from '../utils/api'
import { paise2inr } from '../utils/format'

export default function PayoutForm({ merchant, onSuccess }) {
  const [amountRs, setAmountRs] = useState('')
  const [bankAccountId, setBankAccountId] = useState(merchant.bank_accounts[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)

  const availablePaise = merchant.available_balance_paise
  const amountPaise = Math.round(parseFloat(amountRs || 0) * 100)

  async function submit() {
    setErr(null); setOk(null)
    if (amountPaise <= 0) { setErr('Enter a valid amount'); return }
    if (amountPaise > availablePaise) { setErr(`Exceeds available balance (${paise2inr(availablePaise)})`); return }
    setLoading(true)
    try {
      const payout = await api.createPayout(merchant.id, { amount_paise: amountPaise, bank_account_id: bankAccountId }, uuidv4())
      setOk(`Payout #${String(payout.id).slice(0,8)}… queued`)
      setAmountRs('')
      onSuccess()
    } catch (e) {
      setErr(e.error || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.75rem' }}>
      <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: '1.25rem', letterSpacing: 1 }}>REQUEST PAYOUT</h3>

      <label style={{ display: 'block', color: 'var(--muted)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
        Amount (₹)
      </label>
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontFamily: 'monospace' }}>₹</span>
        <input
          type="number" min="1" step="0.01"
          value={amountRs} onChange={e => setAmountRs(e.target.value)}
          placeholder="0.00"
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem 0.75rem 2rem', color: 'var(--text)', fontSize: 18, fontFamily: 'IBM Plex Mono, monospace', outline: 'none' }}
        />
      </div>

      {merchant.bank_accounts.length > 1 && (
        <>
          <label style={{ display: 'block', color: 'var(--muted)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Bank Account</label>
          <select
            value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}
            style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', color: 'var(--text)', marginBottom: '1rem', outline: 'none' }}>
            {merchant.bank_accounts.map(b => (
              <option key={b.id} value={b.id}>{b.account_holder} — ••••{b.account_number.slice(-4)}</option>
            ))}
          </select>
        </>
      )}

      {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: '0.75rem' }}>⚠ {err}</p>}
      {ok && <p style={{ color: 'var(--accent)', fontSize: 13, marginBottom: '0.75rem' }}>✓ {ok}</p>}

      <button
        onClick={submit} disabled={loading}
        style={{ width: '100%', background: loading ? 'var(--border)' : 'var(--accent)', color: '#0a0a0f', border: 'none', borderRadius: 10, padding: '0.85rem', fontWeight: 700, fontSize: 14, letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s', fontFamily: 'Syne, sans-serif' }}>
        {loading ? 'PROCESSING...' : 'WITHDRAW FUNDS'}
      </button>
    </div>
  )
}
