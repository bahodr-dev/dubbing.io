import crypto, { randomUUID } from 'crypto';
import { db } from '../../db.js';
import * as userRepository from '../../repositories/userRepository.js';

export const ClickError = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INVALID_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  USER_UPDATE_FAILED: -7,
  REQUEST_ERROR: -8,
  TRANSACTION_CANCELLED: -9,
};

export function verifyClickSignature(params) {
  const {
    click_trans_id,
    service_id,
    merchant_trans_id,
    merchant_prepare_id,
    amount,
    action,
    sign_time,
    sign_string,
  } = params;

  const secretKey = process.env.CLICK_SECRET_KEY || 'dubbing_click_test_secret_key_2026';

  let rawString = '';
  if (parseInt(action, 10) === 1) {
    // Complete
    rawString = `${click_trans_id}${service_id}${secretKey}${merchant_trans_id}${merchant_prepare_id || merchant_trans_id}${amount}${action}${sign_time}`;
  } else {
    // Prepare
    rawString = `${click_trans_id}${service_id}${secretKey}${merchant_trans_id}${amount}${action}${sign_time}`;
  }

  const calculatedMd5 = crypto.createHash('md5').update(rawString).digest('hex');
  return calculatedMd5.toLowerCase() === (sign_string || '').toLowerCase();
}

export function generateClickCheckoutUrl({ orderId, amountUzs, returnUrl }) {
  const serviceId = process.env.CLICK_SERVICE_ID || '32847';
  const merchantId = process.env.CLICK_MERCHANT_ID || '24561';
  const appUrl = returnUrl || `${process.env.APP_URL || 'http://localhost:5173'}/dashboard?payment=success`;

  return `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${amountUzs}&transaction_param=${orderId}&return_url=${encodeURIComponent(appUrl)}`;
}

export async function handleClickPrepare(params) {
  const {
    click_trans_id,
    service_id,
    merchant_trans_id, // order_id
    amount,
    action,
    sign_time,
    error,
  } = params;

  // 1. Signature verification
  if (!verifyClickSignature(params)) {
    return {
      error: ClickError.SIGN_CHECK_FAILED,
      error_note: 'SIGN CHECK FAILED!',
    };
  }

  if (parseInt(error, 10) < 0) {
    return {
      error: ClickError.REQUEST_ERROR,
      error_note: 'Request error from Click',
    };
  }

  // 2. Validate order
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(merchant_trans_id);
  if (!order) {
    return {
      error: ClickError.ORDER_NOT_FOUND,
      error_note: 'Order not found',
    };
  }

  // Check amount
  const parsedAmount = parseFloat(amount);
  if (Math.abs(parsedAmount - order.amount_uzs) > 0.01) {
    return {
      error: ClickError.INVALID_AMOUNT,
      error_note: 'Incorrect amount',
    };
  }

  if (order.status === 'completed') {
    return {
      error: ClickError.ALREADY_PAID,
      error_note: 'Order already paid',
    };
  }

  // 3. Record click prepare transaction
  const existing = db.prepare('SELECT * FROM click_transactions WHERE click_trans_id = ?').get(click_trans_id);
  if (!existing) {
    db.prepare(`
      INSERT INTO click_transactions (id, click_trans_id, service_id, order_id, merchant_trans_id, amount, action, sign_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prepare')
    `).run(randomUUID(), click_trans_id, service_id, order.id, merchant_trans_id, parsedAmount, action, sign_time);
  }

  return {
    click_trans_id,
    merchant_trans_id,
    merchant_prepare_id: merchant_trans_id,
    error: ClickError.SUCCESS,
    error_note: 'Success',
  };
}

export async function handleClickComplete(params) {
  const {
    click_trans_id,
    service_id,
    merchant_trans_id, // order_id
    merchant_prepare_id,
    amount,
    action,
    sign_time,
    error,
  } = params;

  // 1. Signature verification
  if (!verifyClickSignature(params)) {
    return {
      error: ClickError.SIGN_CHECK_FAILED,
      error_note: 'SIGN CHECK FAILED!',
    };
  }

  const orderId = merchant_prepare_id || merchant_trans_id;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  if (!order) {
    return {
      error: ClickError.ORDER_NOT_FOUND,
      error_note: 'Order not found',
    };
  }

  // Handle cancelled by user or Click
  if (parseInt(error, 10) < 0) {
    db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(order.id);
    db.prepare(`UPDATE click_transactions SET status = 'cancelled', error = ? WHERE click_trans_id = ?`)
      .run(error, click_trans_id);

    return {
      error: ClickError.TRANSACTION_CANCELLED,
      error_note: 'Transaction cancelled',
    };
  }

  // If already completed (Idempotency)
  if (order.status === 'completed') {
    return {
      click_trans_id,
      merchant_trans_id,
      merchant_confirm_id: order.id,
      error: ClickError.SUCCESS,
      error_note: 'Already completed',
    };
  }

  // Validate amount
  const parsedAmount = parseFloat(amount);
  if (Math.abs(parsedAmount - order.amount_uzs) > 0.01) {
    return {
      error: ClickError.INVALID_AMOUNT,
      error_note: 'Incorrect amount',
    };
  }

  // 2. Mark order completed
  db.prepare(`UPDATE orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(order.id);

  // Update click transactions record
  const existingTrans = db.prepare('SELECT * FROM click_transactions WHERE click_trans_id = ?').get(click_trans_id);
  if (existingTrans) {
    db.prepare(`UPDATE click_transactions SET status = 'completed', action = ?, sign_time = ? WHERE click_trans_id = ?`)
      .run(action, sign_time, click_trans_id);
  } else {
    db.prepare(`
      INSERT INTO click_transactions (id, click_trans_id, service_id, order_id, merchant_trans_id, amount, action, sign_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `).run(randomUUID(), click_trans_id, service_id, order.id, merchant_trans_id, parsedAmount, action, sign_time);
  }

  // 3. Credit user subscription and minutes!
  const planTier = order.plan_id === 'pro' ? 'pro' : (order.plan_id === 'creator' ? 'creator' : 'free');
  userRepository.creditSubscription(order.user_id, {
    plan: planTier,
    minutesToAdd: order.minutes_credited,
    durationDays: order.billing_cycle === 'yearly' ? 365 : 30,
  });

  return {
    click_trans_id,
    merchant_trans_id,
    merchant_confirm_id: order.id,
    error: ClickError.SUCCESS,
    error_note: 'Success',
  };
}
