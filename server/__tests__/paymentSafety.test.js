import { beforeAll, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db.js';

// Exercise real HTTP callbacks, storage and entitlement updates together.
describe('Payment callback safety', () => {
  let cookie;
  let userId;
  let sequence = 0;
  const paymeAuth = `Basic ${Buffer.from(`Paycom:${process.env.PAYME_SECRET_KEY || 'dubbing_payme_test_secret_key_2026'}`).toString('base64')}`;
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: `payment-safety-${Date.now()}@example.com`, password: 'Password123!', name: 'Payment Safety',
    });
    cookie = res.headers['set-cookie'].find((value) => value.includes('dubla_session='));
    userId = res.body.user.id;
  });
  const balance = () => db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(userId).minutes_balance;
  async function checkout(provider) {
    const response = await request(app).post('/api/payments/checkout').set('Cookie', cookie)
      .send({ provider, planId: 'pack_30' });
    expect(response.status).toBe(201);
    return response.body;
  }
  function clickParams(orderId, overrides = {}) {
    const params = {
      click_trans_id: `safety-${Date.now()}-${++sequence}`, service_id: process.env.CLICK_SERVICE_ID || '32847',
      merchant_trans_id: orderId, amount: '195000.00', action: '0', error: '0', sign_time: '2026-10-25 12:00:00', ...overrides,
    };
    const secret = process.env.CLICK_SECRET_KEY || 'dubbing_click_test_secret_key_2026';
    const raw = `${params.click_trans_id}${params.service_id}${secret}${params.merchant_trans_id}${String(params.action) === '1' ? params.merchant_prepare_id : ''}${params.amount}${params.action}${params.sign_time}`;
    return { ...params, sign_string: crypto.createHash('md5').update(raw).digest('hex') };
  }
  const click = (step, params) => request(app).post(`/api/payments/click/${step}`).type('form').send(params);
  const payme = (method, params, id = 0) => request(app).post('/api/payments/payme')
    .set('Authorization', paymeAuth).send({ id, method, params });

  it('adds an order reference to the return URL without claiming success', async () => {
    const result = await checkout('click');
    const url = new URL(new URL(result.paymentUrls.selected).searchParams.get('return_url'));
    expect(url.searchParams.get('paymentOrder')).toBe(result.order.id);
    expect(url.searchParams.has('payment')).toBe(false);
  });

  it('rejects Click completion without a prepared transaction', async () => {
    const { order } = await checkout('click');
    const before = balance();
    const response = await click('complete', clickParams(order.id, { action: '1', merchant_prepare_id: '123' }));
    expect(response.body.error).toBe(-6);
    expect(balance()).toBe(before);
    expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(order.id).status).toBe('pending');
  });

  it.each(['NaN', '195000junk', '195000.001', 'Infinity', '-195000'])('rejects invalid Click amounts: %s', async (amount) => {
    const { order } = await checkout('click');
    const response = await click('prepare', clickParams(order.id, { amount }));
    expect(response.body.error).toBe(-8);
    expect(db.prepare('SELECT id FROM click_transactions WHERE order_id = ?').get(order.id)).toBeUndefined();
  });

  it('rejects a validly signed action sent to the wrong Click endpoint', async () => {
    const { order } = await checkout('click');
    const response = await click('prepare', clickParams(order.id, { action: '1', merchant_prepare_id: '123' }));
    expect(response.body.error).toBe(-3);
  });

  it('binds the Click transaction and prepare ID to the same order', async () => {
    const { order: first } = await checkout('click');
    const { order: second } = await checkout('click');
    const params = clickParams(first.id);
    const prepared = await click('prepare', params);
    expect(prepared.body.error).toBe(0);
    const response = await click('complete', clickParams(second.id, {
      click_trans_id: params.click_trans_id, action: '1', merchant_prepare_id: prepared.body.merchant_prepare_id,
    }));
    expect(response.body.error).toBe(-6);
  });

  it('credits Click once and preserves a completed payment after a delayed failure', async () => {
    const { order } = await checkout('click');
    const params = clickParams(order.id);
    const prepared = await click('prepare', params);
    const complete = clickParams(order.id, { click_trans_id: params.click_trans_id, action: '1', merchant_prepare_id: prepared.body.merchant_prepare_id });
    const before = balance();
    expect((await click('complete', complete)).body.error).toBe(0);
    expect((await click('complete', complete)).body.error).toBe(0);
    expect(balance()).toBe(before + 30);
    expect((await click('complete', { ...complete, error: '-1' })).body.error).toBe(-4);
    expect(balance()).toBe(before + 30);
    expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(order.id).status).toBe('completed');
  });

  it('never resurrects a cancelled Click payment', async () => {
    const { order } = await checkout('click');
    const params = clickParams(order.id);
    const prepared = await click('prepare', params);
    const complete = clickParams(order.id, { click_trans_id: params.click_trans_id, action: '1', merchant_prepare_id: prepared.body.merchant_prepare_id });
    const before = balance();
    expect((await click('complete', { ...complete, error: '-1' })).body.error).toBe(-9);
    expect((await click('complete', complete)).body.error).toBe(-9);
    expect(balance()).toBe(before);
  });

  it('rolls back Click gateway and order state when the entitlement write fails', async () => {
    const { order } = await checkout('click');
    const params = clickParams(order.id);
    const prepared = await click('prepare', params);
    const complete = clickParams(order.id, { click_trans_id: params.click_trans_id, action: '1', merchant_prepare_id: prepared.body.merchant_prepare_id });
    const before = balance();
    db.exec("CREATE TEMP TRIGGER reject_payment_credit BEFORE INSERT ON payment_credits BEGIN SELECT RAISE(ABORT, 'Injected credit failure'); END");
    try {
      expect((await click('complete', complete)).body.error).toBe(-8);
      expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(order.id).status).toBe('pending');
      expect(db.prepare('SELECT status FROM click_transactions WHERE order_id = ?').get(order.id).status).toBe('prepare');
      expect(balance()).toBe(before);
    } finally { db.exec('DROP TRIGGER reject_payment_credit'); }
    expect((await click('complete', complete)).body.error).toBe(0);
    expect(balance()).toBe(before + 30);
  });

  it('rejects malformed Payme authentication and preserves a zero RPC ID', async () => {
    const response = await request(app).post('/api/payments/payme')
      .set('Authorization', `Basic ${Buffer.from('Paycom').toString('base64')}`).send({ id: 0 });
    expect(response.body.error.code).toBe(-32504);
    expect(response.body.id).toBe(0);
    const invalid = await payme('PerformTransaction', {});
    expect(invalid.body.error.code).toBe(-32602);
    expect(invalid.body.id).toBe(0);
  });

  it('rolls back Payme completion on credit failure, then credits and refunds only once', async () => {
    const { order } = await checkout('payme');
    const id = `payme-safety-${Date.now()}-${++sequence}`;
    const created = await payme('CreateTransaction', { id, time: Date.now(), account: { order_id: order.id }, amount: 19500000 });
    expect(created.body.result.state).toBe(1);
    const before = balance();
    db.exec("CREATE TEMP TRIGGER reject_payment_credit BEFORE INSERT ON payment_credits BEGIN SELECT RAISE(ABORT, 'Injected credit failure'); END");
    try {
      expect((await payme('PerformTransaction', { id })).body.error.code).toBe(-32300);
      expect(db.prepare('SELECT state FROM payme_transactions WHERE payme_id = ?').get(id).state).toBe(1);
      expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(order.id).status).toBe('pending');
      expect(balance()).toBe(before);
    } finally { db.exec('DROP TRIGGER reject_payment_credit'); }
    expect((await payme('PerformTransaction', { id })).body.result.state).toBe(2);
    expect((await payme('PerformTransaction', { id })).body.result.state).toBe(2);
    expect(balance()).toBe(before + 30);
    expect((await payme('CancelTransaction', { id, reason: 1 })).body.result.state).toBe(-2);
    expect((await payme('CancelTransaction', { id, reason: 1 })).body.result.state).toBe(-2);
    expect(balance()).toBe(before);
    expect((await payme('PerformTransaction', { id })).body.error.code).toBe(-31008);
  });

  it('rejects changed order details when a Payme transaction ID is reused', async () => {
    const { order: first } = await checkout('payme');
    const { order: second } = await checkout('payme');
    const params = { id: `payme-reused-${Date.now()}`, time: Date.now(), amount: 19500000, account: { order_id: first.id } };
    expect((await payme('CreateTransaction', params)).body.result.state).toBe(1);
    expect((await payme('CreateTransaction', { ...params, account: { order_id: second.id } })).body.error.code).toBe(-32602);
  });

  it('accepts Payme text/json requests used by Merchant API', async () => {
    const response = await request(app).post('/api/payments/payme').set('Authorization', paymeAuth)
      .set('Content-Type', 'text/json').send(JSON.stringify({ id: 0, method: 'GetStatement', params: { from: 0, to: Date.now() } }));
    expect(response.body.id).toBe(0);
    expect(response.body.result.transactions).toBeInstanceOf(Array);
  });

  it('refuses a Payme refund when the account cannot cover the purchased minutes', async () => {
    const { order } = await checkout('payme');
    const id = `payme-spent-${Date.now()}`;
    await payme('CreateTransaction', { id, time: Date.now(), account: { order_id: order.id }, amount: 19500000 });
    await payme('PerformTransaction', { id });
    const previous = balance();
    db.prepare('UPDATE users SET minutes_balance = 0 WHERE id = ?').run(userId);
    try {
      const response = await payme('CancelTransaction', { id, reason: 1 });
      expect(response.body.error.code).toBe(-31007);
      expect(db.prepare('SELECT state FROM payme_transactions WHERE payme_id = ?').get(id).state).toBe(2);
      expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(order.id).status).toBe('completed');
    } finally { db.prepare('UPDATE users SET minutes_balance = ? WHERE id = ?').run(previous, userId); }
  });

  it('expires stale Payme reservations before allowing a fresh transaction', async () => {
    const { order } = await checkout('payme');
    const id = `payme-expired-${Date.now()}`;
    await payme('CreateTransaction', { id, time: Date.now(), account: { order_id: order.id }, amount: 19500000 });
    db.prepare('UPDATE payme_transactions SET create_time = ? WHERE payme_id = ?').run(Date.now() - 13 * 3600 * 1000, id);
    const retry = await payme('CreateTransaction', { id: `${id}-new`, time: Date.now(), account: { order_id: order.id }, amount: 19500000 });
    expect(retry.body.result.state).toBe(1);
    const expired = db.prepare('SELECT state, reason FROM payme_transactions WHERE payme_id = ?').get(id);
    expect(expired).toEqual({ state: -1, reason: 4 });
    expect((await payme('PerformTransaction', { id })).body.error.code).toBe(-31008);
  });

  it('includes a usable unescaped return URL inside the Payme base64 parameters', async () => {
    const result = await checkout('payme');
    const encoded = new URL(result.paymentUrls.selected).pathname.slice(1);
    const decoded = Buffer.from(encoded, 'base64').toString();
    const returnUrl = new URL(decoded.split(';c=')[1]);
    expect(returnUrl.searchParams.get('paymentOrder')).toBe(result.order.id);
    expect(decoded).toContain(';a=19500000;');
  });

  it('accepts Payme cancellation reason 10 for an unknown provider error', async () => {
    const { order } = await checkout('payme');
    const id = `payme-reason10-${Date.now()}`;
    await payme('CreateTransaction', { id, time: Date.now(), account: { order_id: order.id }, amount: 19500000 });
    const response = await payme('CancelTransaction', { id, reason: 10 });
    expect(response.body.result.state).toBe(-1);
    expect(db.prepare('SELECT reason FROM payme_transactions WHERE payme_id = ?').get(id).reason).toBe(10);
  });

  it('does not create checkout orders when provider credentials are missing', async () => {
    const previous = { NODE_ENV: process.env.NODE_ENV, CLICK_SECRET_KEY: process.env.CLICK_SECRET_KEY };
    try {
      process.env.NODE_ENV = 'development';
      delete process.env.CLICK_SECRET_KEY;
      const before = db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
      const response = await request(app).post('/api/payments/checkout').set('Cookie', cookie).send({ provider: 'click', planId: 'pack_30' });
      expect(response.status).toBe(503);
      expect(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count).toBe(before);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
});
