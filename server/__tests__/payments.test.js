import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../app.js';

describe('Payments API & Merchant Integrations (/api/payments)', () => {
  let userCookie = '';
  let userId = '';
  let userEmail = '';
  let orderId = '';
  const paymeSecret = process.env.PAYME_SECRET_KEY || 'dubbing_payme_test_secret_key_2026';
  const paymeAuth = 'Basic ' + Buffer.from(`Paycom:${paymeSecret}`).toString('base64');
  const clickSecret = process.env.CLICK_SECRET_KEY || 'dubbing_click_test_secret_key_2026';

  beforeAll(async () => {
    userEmail = `pay_user_${Date.now()}@dubbing.io`;
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: userEmail,
        password: 'Password123!',
        name: 'Payment Tester',
      });
    const cookies = res.headers['set-cookie'] || [];
    userCookie = cookies.find((c) => c.includes('dubbing_session='));
    userId = res.body.user.id;
  });

  it('GET /api/payments/plans - returns all plans with USD and UZS prices', async () => {
    const res = await request(app).get('/api/payments/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans).toBeInstanceOf(Array);
    const creator = res.body.plans.find((p) => p.id === 'creator');
    expect(creator).toBeDefined();
    expect(creator.priceMonthlyUZS).toBeGreaterThan(0);
    expect(creator.priceMonthlyUSD).toBeGreaterThan(0);
    expect(res.body.supportedProviders).toBeInstanceOf(Array);
  });

  it('POST /api/payments/checkout - creates an order and generates payment URLs', async () => {
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Cookie', userCookie)
      .send({
        planId: 'creator',
        billingCycle: 'monthly',
        provider: 'payme',
      });

    expect(res.status).toBe(201);
    expect(res.body.order).toHaveProperty('id');
    expect(res.body.order.planId).toBe('creator');
    expect(res.body.order.status).toBe('pending');
    expect(res.body.paymentUrls).toHaveProperty('payme');
    expect(res.body.paymentUrls).toHaveProperty('click');
    orderId = res.body.order.id;
  });

  it('GET /api/payments/orders/:id - user can fetch order details', async () => {
    const res = await request(app)
      .get(`/api/payments/orders/${orderId}`)
      .set('Cookie', userCookie);

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(orderId);
    expect(res.body.subscription.plan).toBe('free');
  });

  describe('Payme Merchant JSON-RPC 2.0 Webhook Flow', () => {
    const paymeTransId = `payme-trans-${Date.now()}`;
    const amountTiyin = 375000 * 100; // Creator monthly price in tiyin

    it('POST /api/payments/payme - rejects without valid Basic Auth', async () => {
      const res = await request(app)
        .post('/api/payments/payme')
        .send({
          id: 1,
          method: 'CheckPerformTransaction',
          params: { account: { order_id: orderId }, amount: amountTiyin },
        });

      expect(res.status).toBe(200);
      expect(res.body.error.code).toBe(-32504);
    });

    it('POST /api/payments/payme - CheckPerformTransaction succeeds with valid order', async () => {
      const res = await request(app)
        .post('/api/payments/payme')
        .set('Authorization', paymeAuth)
        .send({
          id: 2,
          method: 'CheckPerformTransaction',
          params: { account: { order_id: orderId }, amount: amountTiyin },
        });

      expect(res.status).toBe(200);
      expect(res.body.result.allow).toBe(true);
    });

    it('POST /api/payments/payme - CreateTransaction sets state to 1', async () => {
      const res = await request(app)
        .post('/api/payments/payme')
        .set('Authorization', paymeAuth)
        .send({
          id: 3,
          method: 'CreateTransaction',
          params: {
            id: paymeTransId,
            time: Date.now(),
            amount: amountTiyin,
            account: { order_id: orderId },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.result.state).toBe(1);
      expect(res.body.result.transaction).toBe(paymeTransId);
    });

    it('POST /api/payments/payme - PerformTransaction sets state to 2 and upgrades user plan', async () => {
      const res = await request(app)
        .post('/api/payments/payme')
        .set('Authorization', paymeAuth)
        .send({
          id: 4,
          method: 'PerformTransaction',
          params: { id: paymeTransId },
        });

      expect(res.status).toBe(200);
      expect(res.body.result.state).toBe(2);

      // Verify user subscription upgraded
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', userCookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.plan).toBe('creator');
      expect(meRes.body.user.minutesBalance).toBeGreaterThanOrEqual(65); // 5 free + 60 creator
    });

    it('POST /api/payments/payme - CheckTransaction returns completed state 2', async () => {
      const res = await request(app)
        .post('/api/payments/payme')
        .set('Authorization', paymeAuth)
        .send({
          id: 5,
          method: 'CheckTransaction',
          params: { id: paymeTransId },
        });

      expect(res.status).toBe(200);
      expect(res.body.result.state).toBe(2);
      expect(res.body.result.perform_time).toBeGreaterThan(0);
    });
  });

  describe('Click Merchant SHOP API Flow', () => {
    let clickOrderId = '';
    const clickTransId = `click-trans-${Date.now()}`;
    const clickServiceId = '32847';
    const clickAmount = 1150000; // Pro monthly in UZS

    beforeAll(async () => {
      // Create new Pro order for Click
      const res = await request(app)
        .post('/api/payments/checkout')
        .set('Cookie', userCookie)
        .send({
          planId: 'pro',
          billingCycle: 'monthly',
          provider: 'click',
        });
      clickOrderId = res.body.order.id;
    });

    it('POST /api/payments/click/prepare - rejects with invalid signature', async () => {
      const res = await request(app)
        .post('/api/payments/click/prepare')
        .send({
          click_trans_id: clickTransId,
          service_id: clickServiceId,
          merchant_trans_id: clickOrderId,
          amount: clickAmount,
          action: 0,
          sign_time: '2026-09-02 12:00:00',
          sign_string: 'invalid_md5_signature',
        });

      expect(res.status).toBe(200);
      expect(res.body.error).toBe(-1); // SIGN_CHECK_FAILED
    });

    it('POST /api/payments/click/prepare - succeeds with valid MD5 signature', async () => {
      const signTime = '2026-09-02 12:00:00';
      const rawString = `${clickTransId}${clickServiceId}${clickSecret}${clickOrderId}${clickAmount}0${signTime}`;
      const signString = crypto.createHash('md5').update(rawString).digest('hex');

      const res = await request(app)
        .post('/api/payments/click/prepare')
        .send({
          click_trans_id: clickTransId,
          service_id: clickServiceId,
          merchant_trans_id: clickOrderId,
          amount: clickAmount,
          action: 0,
          sign_time: signTime,
          sign_string: signString,
        });

      expect(res.status).toBe(200);
      expect(res.body.error).toBe(0);
      expect(res.body.merchant_prepare_id).toBe(clickOrderId);
    });

    it('POST /api/payments/click/complete - confirms payment and upgrades plan to Pro', async () => {
      const signTime = '2026-09-02 12:00:05';
      const rawString = `${clickTransId}${clickServiceId}${clickSecret}${clickOrderId}${clickOrderId}${clickAmount}1${signTime}`;
      const signString = crypto.createHash('md5').update(rawString).digest('hex');

      const res = await request(app)
        .post('/api/payments/click/complete')
        .send({
          click_trans_id: clickTransId,
          service_id: clickServiceId,
          merchant_trans_id: clickOrderId,
          merchant_prepare_id: clickOrderId,
          amount: clickAmount,
          action: 1,
          sign_time: signTime,
          sign_string: signString,
        });

      expect(res.status).toBe(200);
      expect(res.body.error).toBe(0);
      expect(res.body.merchant_confirm_id).toBe(clickOrderId);

      // Verify user subscription is upgraded to Pro
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', userCookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.plan).toBe('pro');
      expect(meRes.body.user.minutesBalance).toBeGreaterThanOrEqual(365); // 65 + 300
    });
  });

  describe('Instant Simulation for Local Development', () => {
    it('POST /api/payments/simulate-success - adds extra minutes pack instantly', async () => {
      const checkoutRes = await request(app)
        .post('/api/payments/checkout')
        .set('Cookie', userCookie)
        .send({
          planId: 'pack_100',
          billingCycle: 'monthly',
          provider: 'payme',
        });

      const simOrderId = checkoutRes.body.order.id;

      const res = await request(app)
        .post('/api/payments/simulate-success')
        .set('Cookie', userCookie)
        .send({ orderId: simOrderId });

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('completed');
      expect(res.body.user.minutesBalance).toBeGreaterThanOrEqual(465); // previous + 100
    });
  });
});
