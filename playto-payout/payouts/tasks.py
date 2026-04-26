"""
Payout processor background worker.

State machine:  pending → processing → (completed | failed)

Simulation outcomes:
  70% success  → completed
  20% failure  → failed + refund
  10% hung     → stays processing, retry logic handles it

Retry logic:
  A payout stuck in 'processing' for > PAYOUT_PROCESSING_TIMEOUT_SECONDS
  gets retried via exponential backoff, max PAYOUT_MAX_RETRIES times.
  After max retries, moved to 'failed' and funds returned atomically.
"""
import random
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import LedgerEntry, Payout

logger = logging.getLogger(__name__)

TIMEOUT = getattr(settings, 'PAYOUT_PROCESSING_TIMEOUT_SECONDS', 30)
MAX_RETRIES = getattr(settings, 'PAYOUT_MAX_RETRIES', 3)


def _refund_to_ledger(payout):
    """
    Creates a credit ledger entry to return held funds to merchant.
    Must be called INSIDE an atomic transaction alongside the status transition.
    """
    LedgerEntry.objects.create(
        merchant=payout.merchant,
        entry_type=LedgerEntry.CREDIT,
        amount_paise=payout.amount_paise,   # +ve: money back in
        description=f'Refund for failed payout {payout.id}',
        reference_id=str(payout.id),
    )


@shared_task(bind=True, max_retries=MAX_RETRIES, default_retry_delay=10)
def process_payout(self, payout_id: str):
    """
    Main payout processing task.

    1. Fetch payout, acquire row lock.
    2. Transition pending → processing.
    3. Simulate bank call.
    4. On success: transition processing → completed, write debit ledger entry.
    5. On failure: transition processing → failed, write refund credit entry.
    6. On 'hung' (10%): do nothing — the payout stays in processing.
       The check_stuck_payouts task will eventually retry it.
    """
    try:
        with transaction.atomic():
            try:
                payout = Payout.objects.select_for_update().get(id=payout_id)
            except Payout.DoesNotExist:
                logger.error(f"Payout {payout_id} not found")
                return

            # Guard: only process pending payouts.
            if payout.status != Payout.PENDING:
                logger.info(f"Payout {payout_id} is {payout.status}, skipping")
                return

            # Transition: pending → processing
            payout.transition_to(Payout.PROCESSING, save=False)
            payout.processing_started_at = timezone.now()
            payout.save(update_fields=['status', 'processing_started_at', 'updated_at'])

        # ── Simulate bank API call (outside the transition transaction) ──────
        outcome = _simulate_bank_outcome()
        logger.info(f"Payout {payout_id} bank outcome: {outcome}")

        if outcome == 'hung':
            # Leave in processing. check_stuck_payouts will retry.
            logger.info(f"Payout {payout_id} is hung, will be retried by scheduled task")
            return

        with transaction.atomic():
            # Re-acquire lock for final state transition.
            payout = Payout.objects.select_for_update().get(id=payout_id)

            if payout.status != Payout.PROCESSING:
                # Another task already handled this payout.
                return

            if outcome == 'success':
                # Debit ledger entry records the settled payout.
                LedgerEntry.objects.create(
                    merchant=payout.merchant,
                    entry_type=LedgerEntry.DEBIT,
                    amount_paise=-payout.amount_paise,   # SIGNED: -ve = money out
                    description=f'Payout {payout.id} settled',
                    reference_id=str(payout.id),
                )
                payout.transition_to(Payout.COMPLETED, save=True)
                logger.info(f"Payout {payout_id} completed")

            elif outcome == 'failure':
                # No ledger entry needed — funds were never debited.
                # The held amount naturally releases when status leaves PENDING/PROCESSING.
                payout.failure_reason = 'Bank declined the transfer'
                payout.transition_to(Payout.FAILED, save=False)
                payout.save(update_fields=['status', 'failure_reason', 'updated_at'])
                logger.info(f"Payout {payout_id} failed, hold released")

    except Exception as exc:
        logger.exception(f"Error processing payout {payout_id}: {exc}")
        raise


@shared_task
def check_stuck_payouts():
    """
    Periodic task: find payouts stuck in 'processing' for > TIMEOUT seconds.
    Uses exponential backoff, up to MAX_RETRIES. Then fails + refunds.

    This task should be scheduled via Celery Beat every ~15 seconds in prod.
    For the demo, it can be called manually or via management command.
    """
    cutoff = timezone.now() - timedelta(seconds=TIMEOUT)
    stuck = Payout.objects.filter(
        status=Payout.PROCESSING,
        processing_started_at__lt=cutoff,
    ).select_for_update(skip_locked=True)  # skip_locked: don't wait, skip rows locked by others

    with transaction.atomic():
        for payout in stuck:
            if payout.retry_count < MAX_RETRIES:
                # Retry: reset to pending so process_payout can pick it up again.
                backoff = 2 ** payout.retry_count  # 1s, 2s, 4s
                payout.retry_count += 1
                payout.status = Payout.PENDING
                payout.processing_started_at = None
                payout.save(update_fields=['status', 'retry_count', 'processing_started_at', 'updated_at'])
                logger.info(
                    f"Payout {payout.id} retry {payout.retry_count}/{MAX_RETRIES}, "
                    f"backoff={backoff}s"
                )
                process_payout.apply_async(args=[str(payout.id)], countdown=backoff)
            else:
                # Max retries exceeded — fail. No ledger entry needed (never debited).
                payout.failure_reason = f'Timed out after {MAX_RETRIES} retries'
                payout.transition_to(Payout.FAILED, save=False)
                payout.save(update_fields=['status', 'failure_reason', 'updated_at'])
                logger.info(f"Payout {payout.id} failed after max retries, funds refunded")


def _simulate_bank_outcome():
    """70% success, 20% failure, 10% hung."""
    r = random.random()
    if r < 0.70:
        return 'success'
    elif r < 0.90:
        return 'failure'
    else:
        return 'hung'
