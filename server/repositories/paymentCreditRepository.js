import { db } from '../db.js';
import * as userRepository from './userRepository.js';

function addDays(isoDate, days) {
  const base = isoDate && new Date(isoDate).getTime() > Date.now()
    ? new Date(isoDate)
    : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

/**
 * Applies an order exactly once and records the resulting entitlement so a
 * gateway refund can reverse the same credit without guessing at balances.
 */
export function applyPaymentCredit(orderId) {
  const apply = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('Order not found.');

    const existing = db.prepare('SELECT * FROM payment_credits WHERE order_id = ?').get(orderId);
    if (existing) return userRepository.findById(order.user_id);

    const user = userRepository.findById(order.user_id);
    if (!user) throw new Error('Order user not found.');

    const isAddon = order.plan_id.startsWith('pack_');
    const nextPlan = isAddon ? (user.plan || 'free') : order.plan_id;
    const nextExpiry = isAddon
      ? (user.subscription_expires_at || null)
      : addDays(user.subscription_expires_at, order.billing_cycle === 'yearly' ? 365 : 30);

    db.prepare(`
      UPDATE users
      SET plan = ?,
          minutes_balance = ROUND(COALESCE(minutes_balance, 0) + ?, 6),
          subscription_expires_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextPlan, order.minutes_credited, nextExpiry, user.id);

    db.prepare(`
      INSERT INTO payment_credits (
        order_id, user_id, minutes, previous_plan, previous_subscription_expires_at,
        applied_plan, applied_subscription_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      order.id,
      user.id,
      order.minutes_credited,
      user.plan || 'free',
      user.subscription_expires_at || null,
      nextPlan,
      nextExpiry,
    );

    return userRepository.findById(user.id);
  });

  return apply.immediate();
}

/** Reverses a completed order exactly once. It preserves later entitlements. */
export function reversePaymentCredit(orderId) {
  const reverse = db.transaction(() => {
    const credit = db.prepare('SELECT * FROM payment_credits WHERE order_id = ?').get(orderId);
    if (!credit || credit.reversed_at) return { reversed: false, user: null };

    const user = userRepository.findById(credit.user_id);
    if (!user) throw new Error('Payment-credit user not found.');

    // Restore the prior subscription only when no later payment changed it.
    const restoreSubscription = user.plan === credit.applied_plan &&
      (user.subscription_expires_at || null) === (credit.applied_subscription_expires_at || null);

    db.prepare(`
      UPDATE users
      SET minutes_balance = MAX(0, ROUND(COALESCE(minutes_balance, 0) - ?, 6)),
          plan = ?,
          subscription_expires_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      credit.minutes,
      restoreSubscription ? credit.previous_plan : user.plan,
      restoreSubscription ? credit.previous_subscription_expires_at : user.subscription_expires_at,
      user.id,
    );
    db.prepare('UPDATE payment_credits SET reversed_at = CURRENT_TIMESTAMP WHERE order_id = ? AND reversed_at IS NULL')
      .run(orderId);

    return { reversed: true, user: userRepository.findById(user.id) };
  });

  return reverse.immediate();
}
