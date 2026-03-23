// ── SM-2 Spaced Repetition Algorithm ─────────────────────────────
//
// Ratings:  0 = Again  (complete blackout / wrong)
//           1 = Good   (correct with effort)
//           2 = Easy   (correct, felt simple)
//
// Each card carries:
//   interval    — days until next review (integer, min 1)
//   easeFactor  — multiplier (float, min 1.3, default 2.5)
//   nextReview  — ISO date string (YYYY-MM-DD)

const MIN_EASE   = 1.3;
const DEFAULT_EASE = 2.5;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Given a card's current SR fields and the user's rating,
 * return the updated fields to write back to Firestore.
 *
 * @param {object} card   — { interval, easeFactor, nextReview }
 * @param {number} rating — 0 (Again) | 1 (Good) | 2 (Easy)
 * @returns {object}      — { interval, easeFactor, nextReview }
 */
export function calculateNextReview(card, rating) {
  let interval   = card.interval   ?? 1;
  let easeFactor = card.easeFactor ?? DEFAULT_EASE;

  if (rating === 0) {
    // Again — reset, review tomorrow
    interval   = 1;
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
  } else if (rating === 1) {
    // Good — advance by current interval
    interval   = Math.round(interval * easeFactor);
    // easeFactor unchanged
  } else {
    // Easy — advance further, boost ease slightly
    interval   = Math.round(interval * easeFactor * 1.3);
    easeFactor = Math.min(easeFactor + 0.1, 4.0);
  }

  // Hard floor: never less than 1 day
  interval = Math.max(1, interval);

  return {
    interval,
    easeFactor,
    nextReview: addDays(interval),
  };
}

/**
 * Returns true if a card is due today or overdue.
 * Cards with no nextReview field are always due.
 */
export function isDue(card) {
  if (!card.nextReview) return true;
  return card.nextReview <= todayISO();
}

/**
 * Sort cards: overdue first, then due today, then by nextReview asc.
 * Cards with no nextReview sort to the very front.
 */
export function sortByDue(cards) {
  const today = todayISO();
  return [...cards].sort((a, b) => {
    const aDate = a.nextReview ?? '0000-00-00';
    const bDate = b.nextReview ?? '0000-00-00';
    // Both future — sort ascending
    if (aDate > today && bDate > today) return aDate.localeCompare(bDate);
    // One future, one due — due card goes first
    if (aDate > today) return  1;
    if (bDate > today) return -1;
    // Both due/overdue — most overdue first
    return aDate.localeCompare(bDate);
  });
}