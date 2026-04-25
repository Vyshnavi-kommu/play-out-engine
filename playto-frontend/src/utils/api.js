const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  const data = await res.json()
  if (!res.ok) throw { status: res.status, ...data }
  return data
}

export const api = {
  getMerchants: () => req('/merchants/'),
  getMerchant: (id) => req(`/merchants/${id}/`),
  getLedger: (id) => req(`/merchants/${id}/ledger/`),
  getPayouts: (merchantId) => req(`/payouts/?merchant_id=${merchantId}`),
  createPayout: (merchantId, body, idempotencyKey) =>
    req(`/payouts?merchant_id=${merchantId}`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ ...body, merchant_id: merchantId }),
    }),
}
