# Playto Payout Engine

A minimal but production-correct payout engine. Handles merchant ledger, concurrent payout requests, idempotency, and background bank simulation.

## Stack
- **Backend**: Django 5 + DRF
- **Database**: PostgreSQL (BigIntegerField for all paise amounts, no floats)
- **Queue**: Celery + Redis
- **Frontend**: React + Vite + Tailwind

---

## Quick Start (Docker)

```bash
git clone <repo>
cd playto-payout

docker-compose up --build
```

- Backend API: http://localhost:8000/api/v1/
- Frontend: http://localhost:3000
- Admin: http://localhost:8000/admin/

Seed data is loaded automatically on first boot.

---

## Local Development (no Docker)

### Prerequisites
- Python 3.12+
- PostgreSQL 15+
- Redis 7+
- Node 20+

### Backend

```bash
cd playto-payout
pip install -r requirements.txt

# Option A: PostgreSQL (recommended — required for concurrency test)
export POSTGRES_DB=playto_payout
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export CELERY_BROKER_URL=redis://localhost:6379/0

# Option B: SQLite + eager tasks (no Postgres/Redis needed, dev-only)
export DATABASE_URL=sqlite:///db.sqlite3
export CELERY_TASK_ALWAYS_EAGER=True

python manage.py migrate
python manage.py shell -c "exec(open('seed.py').read())"   # seeds 3 merchants

# Run server
python manage.py runserver 8000

# Run Celery worker (separate terminal — skip if using CELERY_TASK_ALWAYS_EAGER)
celery -A config worker --loglevel=info

# Run Celery beat for stuck-payout checker (separate terminal)
celery -A config beat --loglevel=info
```

### Frontend

```bash
cd playto-frontend
npm install
npm run dev    # http://localhost:3000
```

---

## API Reference

### List merchants
```
GET /api/v1/merchants/
```

### Merchant balance
```
GET /api/v1/merchants/<merchant_id>/
```

### Merchant ledger
```
GET /api/v1/merchants/<merchant_id>/ledger/
```

### Create payout
```
POST /api/v1/payouts?merchant_id=<id>
Headers:
  Idempotency-Key: <uuid>
  Content-Type: application/json

Body:
{
  "amount_paise": 50000,
  "bank_account_id": "<uuid>",
  "merchant_id": "<uuid>"
}
```

Returns `201` on creation, replays same `201` on duplicate idempotency key, `409` if key is in-flight, `400` if insufficient balance.

### List payouts
```
GET /api/v1/payouts/?merchant_id=<id>
```

### Get payout
```
GET /api/v1/payouts/<payout_id>/?merchant_id=<id>
```

---

## Running Tests

```bash
cd playto-payout
python manage.py test payouts.tests
```

Tests require a running PostgreSQL (uses `TransactionTestCase` for real concurrency).

For concurrency test with SQLite you'll see different locking behaviour — PostgreSQL is required for the `SELECT FOR UPDATE` test to be meaningful.

---

## Key Design Decisions

See [EXPLAINER.md](./EXPLAINER.md) for full detail. Short version:

1. **Ledger**: Append-only signed entries. Balance = `SUM(amount_paise)` via DB aggregation.
2. **Concurrency**: `SELECT FOR UPDATE` on merchant row. DB lock serialises all balance checks for a given merchant.
3. **Idempotency**: `get_or_create` on `unique_together(merchant, key)`. In-flight returns 409, resolved returns cached response.
4. **State machine**: `transition_to()` enforces legal transitions via a dict lookup before any DB write.
5. **Retry**: Exponential backoff (1s, 2s, 4s), max 3 retries. Refund and state change atomic.

---

## Admin Portal

The frontend includes a protected admin portal accessible via the **Admin ⚙** button in the top-right header.

**Password:** `admin5657`

The portal is locked behind a client-side password gate (sessionStorage). After login you can:

- View system-wide stats (merchants, volume, success rate)
- See all payouts across every merchant with status filters
- **Force-complete** or **force-cancel** any `pending` or `processing` payout
- **Add new merchants** with bank account details and optional initial balance
- **Auto-retry** all stuck PROCESSING payouts via the retry endpoint

### Admin API Endpoints

```
GET  /api/v1/admin/stats/                        — system metrics
GET  /api/v1/admin/payouts/?status=<s>           — all payouts (200 max, optional filter)
POST /api/v1/admin/payouts/<id>/action/          — force complete or cancel
     Body: { "action": "complete" | "cancel" }
POST /api/v1/admin/retry-stuck/                  — retry all PROCESSING payouts
GET  /api/v1/admin/merchants/                    — all merchants with full stats + bank accounts
POST /api/v1/admin/merchants/                    — create new merchant
     Body: { name, email, account_holder, account_number, ifsc_code, initial_balance_paise }
```

---

## Seeded Merchants

| Name | Balance | Email |
|------|---------|-------|
| Priya Creative Studio | ₹14,500 | priya@creativestudio.in |
| Ravi Freelance Dev | ₹17,500 | ravi@freelancedev.io |
| NexGen Digital Agency | ₹43,000 | billing@nexgendigital.co |

---

## Deployment (Render)

1. Create a PostgreSQL instance on Render.
2. Create a Redis instance on Render.
3. Create a Web Service from this repo:
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn config.wsgi:application`
   - Env: `DATABASE_URL`, `CELERY_BROKER_URL`, `SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS=yourdomain.onrender.com`
4. Create a Background Worker from the same repo:
   - Start: `celery -A config worker --loglevel=info`
5. Run migrations and seed: `python manage.py migrate && python manage.py shell < seed.py`
