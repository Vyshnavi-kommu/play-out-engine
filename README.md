# Playto Payout Engine - Full Stack Submission

This repository contains the complete implementation for the Playto Payout Engine project, including a robust Django backend and a dark industrial React dashboard.

## Project Structure

- `playto-payout/`: Django Backend (Python, DRF, Celery, PostgreSQL, Redis)
- `playto-frontend/`: React Frontend (Vite, Syne + IBM Plex Mono fonts, Accent Green)

## Key Features

- **Pessimistic Locking**: Prevents overdrawing using PostgreSQL `SELECT FOR UPDATE`.
- **Atomic Ledger**: Append-only signed ledger entries for immutable balance history.
- **Idempotency**: Robust idempotency key handling with per-merchant scoping and cached responses.
- **Background Workers**: Celery-based payout simulation (70/20/10) with exponential backoff retries and atomic refunds.
- **Industrial UI**: A high-end, dark-themed dashboard with live polling and status badges.

## Quick Start

### 1. Docker (Recommended)
```bash
cd playto-payout
docker-compose up --build
```
This starts the backend, worker, beat, database, and redis. The frontend should be run separately (see below).

### 2. Manual Setup
See the individual README files in each folder for detailed setup instructions:
- [Backend README](./playto-payout/README.md)
- [Frontend README](./playto-frontend/README.md)

## Deployment

The project is ready for one-click deployment on **Render** using the included `render.yaml` blueprint.

## Design Decisions
For a deep dive into the architecture and concurrency primitives, see [EXPLAINER.md](./playto-payout/EXPLAINER.md).
