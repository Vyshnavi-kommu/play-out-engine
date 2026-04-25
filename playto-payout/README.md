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

# Configure DB
export POSTGRES_DB=playto_payout
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres

python manage.py migrate
python manage.py seed_data

# Run server
python manage.py runserver 8000

# Run Celery worker (separate terminal)
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
5. Run migrations: `python manage.py migrate && python manage.py seed_data`
