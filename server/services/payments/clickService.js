import { isPaymentProviderConfigured } from './paymentConfig.js';
import crypto, { randomUUID } from 'crypto';
import { db } from '../../db.js';
import { applyPaymentCredit } from '../../repositories/paymentCreditRepository.js';

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

// Keep the original scalar values for the provider's signature; validate money
// separately in integer tiyin, without parseFloat accepting trailing garbage.
function amountInTiyin(value) {
  const text = String(value ?? '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text) * 100;
  const rounded = Math.round(amount);
  return Number.isSafeInteger(rounded) && rounded > 0 && Math.abs(amount - rounded) < 0.000001 ? rounded : null;
}

export function verifyClickSignature(params) {
  if (!isPaymentProviderConfigured('click')) return false;
  if (!params || typeof params !== 'object') return false;
  const fields = ['click_trans_id', 'service_id', 'merchant_trans_id', 'amount', 'action', 'sign_time'];
  if (String(params.action) === '1') fields.push('merchant_prepare_id');
  if (!fields.every((key) => ['string', 'number'].includes(typeof params[key]) && String(params[key]).length > 0)) return false;
  if (!/^[0-9a-f]{32}$/i.test(params.sign_string || '')) return false;
  const secret = process.env.CLICK_SECRET_KEY || (process.env.NODE_ENV === 'test' ? 'dubbing_click_test_secret_key_2026' : null);
  if (!secret) return false;
  if (process.env.CLICK_SERVICE_ID && String(params.service_id) !== process.env.CLICK_SERVICE_ID) return false;
  const { click_trans_id, service_id, merchant_trans_id, merchant_prepare_id, amount, action, sign_time } = params;
  const raw = `${click_trans_id}${service_id}${secret}${merchant_trans_id}${String(action) === '1' ? merchant_prepare_id : ''}${amount}${action}${sign_time}`;
  const digest = crypto.createHash('md5').update(raw).digest();
  return crypto.timingSafeEqual(digest, Buffer.from(params.sign_string, 'hex'));
}

export function generateClickCheckoutUrl({ orderId, amountUzs, returnUrl }) {
  const serviceId = process.env.CLICK_SERVICE_ID || (process.env.NODE_ENV === 'test' ? '32847' : '');
  const merchantId = process.env.CLICK_MERCHANT_ID || (process.env.NODE_ENV === 'test' ? '24561' : '');
  const url = new URL('https://my.click.uz/services/pay');
  url.search = new URLSearchParams({
    service_id: serviceId, merchant_id: merchantId, amount: String(amountUzs),
    transaction_param: orderId,
    return_url: returnUrl || `${process.env.APP_URL || 'http://localhost:5173'}/dashboard`,
  }).toString();
  return url.toString();
}

function failure(params, error, error_note) {
  return { click_trans_id: params?.click_trans_id, merchant_trans_id: params?.merchant_trans_id, error, error_note };
}

function validateCallback(params, expectedAction) {
  if (!verifyClickSignature(params)) return failure(params, ClickError.SIGN_CHECK_FAILED, 'SIGN CHECK FAILED!');
  if (String(params.action) !== String(expectedAction)) return failure(params, ClickError.ACTION_NOT_FOUND, 'Action not found');
  if (amountInTiyin(params.amount) === null || (params.error !== undefined && !/^-?\d+$/.test(String(params.error)))) {
    return failure(params, ClickError.REQUEST_ERROR, 'Invalid request parameters');
  }
  return null;
}

export function handleClickPrepare(params) {
  const invalid = validateCallback(params, 0);
  if (invalid) return invalid;
  return db.transaction(() => {
    if (Number(params.error || 0) !== 0) return failure(params, ClickError.REQUEST_ERROR, 'Request error from Click');
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(params.merchant_trans_id);
    if (!order) return failure(params, ClickError.ORDER_NOT_FOUND, 'Order not found');
    if (order.provider !== 'click') return failure(params, ClickError.REQUEST_ERROR, 'Order belongs to another payment provider');
    if (amountInTiyin(params.amount) !== Math.round(order.amount_uzs * 100)) return failure(params, ClickError.INVALID_AMOUNT, 'Incorrect amount');
    if (order.status === 'completed') return failure(params, ClickError.ALREADY_PAID, 'Order already paid');
    if (order.status !== 'pending') return failure(params, ClickError.TRANSACTION_CANCELLED, 'Order is cancelled');
    const existing = db.prepare('SELECT * FROM click_transactions WHERE click_trans_id = ?').get(params.click_trans_id);
    if (existing && (existing.order_id !== order.id || existing.service_id !== String(params.service_id) || Math.round(existing.amount * 100) !== amountInTiyin(params.amount))) {
      return failure(params, ClickError.REQUEST_ERROR, 'Transaction parameters do not match');
    }
    if (existing?.status === 'cancelled') return failure(params, ClickError.TRANSACTION_CANCELLED, 'Transaction cancelled');
    let prepareId = existing?.prepare_id ?? existing?.order_id;
    if (!existing) {
      prepareId = db.prepare('SELECT COALESCE(MAX(prepare_id), 0) + 1 AS next FROM click_transactions').get().next;
      const active = db.prepare("SELECT id FROM click_transactions WHERE order_id = ? AND status = 'prepare'").get(order.id);
      if (active) return failure(params, ClickError.REQUEST_ERROR, 'Another transaction is in progress');
      db.prepare(`INSERT INTO click_transactions (id, click_trans_id, service_id, order_id, merchant_trans_id, amount, action, sign_time, prepare_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'prepare')`)
        .run(randomUUID(), params.click_trans_id, String(params.service_id), order.id, order.id, Number(params.amount), params.sign_time, prepareId);
    }
    return { click_trans_id: params.click_trans_id, merchant_trans_id: order.id, merchant_prepare_id: prepareId, error: 0, error_note: 'Success' };
  }).immediate();
}

export function handleClickComplete(params) {
  const invalid = validateCallback(params, 1);
  if (invalid) return invalid;
  return db.transaction(() => {
    const trans = db.prepare('SELECT * FROM click_transactions WHERE click_trans_id = ?').get(params.click_trans_id);
    if (!trans) return failure(params, ClickError.TRANSACTION_NOT_FOUND, 'Prepare transaction not found');
    if (trans.order_id !== params.merchant_trans_id || String(trans.prepare_id ?? trans.order_id) !== String(params.merchant_prepare_id) || trans.service_id !== String(params.service_id)) {
      return failure(params, ClickError.TRANSACTION_NOT_FOUND, 'Prepare transaction does not match');
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(trans.order_id);
    if (!order) return failure(params, ClickError.ORDER_NOT_FOUND, 'Order not found');
    if (order.provider !== 'click') return failure(params, ClickError.REQUEST_ERROR, 'Order belongs to another payment provider');
    if (amountInTiyin(params.amount) !== Math.round(order.amount_uzs * 100) || amountInTiyin(params.amount) !== Math.round(trans.amount * 100)) {
      return failure(params, ClickError.INVALID_AMOUNT, 'Incorrect amount');
    }
    // A delayed failure must never undo an already delivered successful payment.
    if (trans.status === 'completed') {
      if (Number(params.error || 0) !== 0) return failure(params, ClickError.ALREADY_PAID, 'Order already paid');
      applyPaymentCredit(order.id);
      return { click_trans_id: params.click_trans_id, merchant_trans_id: order.id, merchant_confirm_id: trans.prepare_id ?? order.id, error: 0, error_note: 'Already completed' };
    }
    if (trans.status === 'cancelled' || order.status !== 'pending') return failure(params, ClickError.TRANSACTION_CANCELLED, 'Transaction cancelled');
    if (Number(params.error || 0) < 0) {
      db.prepare("UPDATE click_transactions SET status = 'cancelled', error = ? WHERE id = ?").run(Number(params.error), trans.id);
      db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
      return failure(params, ClickError.TRANSACTION_CANCELLED, 'Transaction cancelled');
    }
    if (Number(params.error || 0) !== 0) return failure(params, ClickError.REQUEST_ERROR, 'Invalid payment status');
    db.prepare("UPDATE orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
    db.prepare("UPDATE click_transactions SET status = 'completed', action = 1, sign_time = ? WHERE id = ?").run(params.sign_time, trans.id);
    applyPaymentCredit(order.id);
    return { click_trans_id: params.click_trans_id, merchant_trans_id: order.id, merchant_confirm_id: trans.prepare_id ?? order.id, error: 0, error_note: 'Success' };
  }).immediate();
}
