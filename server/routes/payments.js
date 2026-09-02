import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { PAYMENT_PLANS, getPlan } from '../services/payments/paymentPlans.js';
import { verifyPaymeAuth, handlePaymeRpc, generatePaymeCheckoutUrl } from '../services/payments/paymeService.js';
import { handleClickPrepare, handleClickComplete, generateClickCheckoutUrl } from '../services/payments/clickService.js';
import * as userRepository from '../repositories/userRepository.js';

export const paymentsRouter = Router();

// 1. GET AVAILABLE PLANS (Public)
paymentsRouter.get('/plans', (_req, res) => {
  return res.json({
    plans: Object.values(PAYMENT_PLANS),
    currencyRates: {
      UZS_PER_USD: 12900,
    },
    supportedProviders: [
      { id: 'payme', name: 'Payme', icon: 'payme', enabled: true },
      { id: 'click', name: 'Click Up', icon: 'click', enabled: true },
      { id: 'uzum', name: 'Uzum Pay / Bank Card', icon: 'uzum', enabled: true },
    ],
  });
});

// 2. CREATE CHECKOUT ORDER (Protected)
paymentsRouter.post('/checkout', authenticateToken, (req, res) => {
  try {
    const { planId, billingCycle = 'monthly', provider = 'payme', returnUrl } = req.body;

    const plan = getPlan(planId);
    if (!plan) {
      return res.status(400).json({ error: 'Selected plan does not exist.' });
    }

    const isYearly = billingCycle === 'yearly';
    const amountUzs = isYearly ? (plan.priceYearlyUZS * 12 || plan.priceMonthlyUZS) : plan.priceMonthlyUZS;
    const amountUsd = isYearly ? (plan.priceYearlyUSD * 12 || plan.priceMonthlyUSD) : plan.priceMonthlyUSD;
    const minutesCredited = isYearly ? plan.minutes * 12 : plan.minutes;

    const orderId = `ord-${Date.now()}-${randomUUID().slice(0, 8)}`;

    // Create database order
    db.prepare(`
      INSERT INTO orders (
        id, user_id, plan_id, plan_name, billing_cycle,
        amount_uzs, amount_usd, minutes_credited, provider, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      orderId,
      req.user.id,
      plan.id,
      plan.name,
      billingCycle,
      amountUzs,
      amountUsd,
      minutesCredited,
      provider
    );

    // Generate direct checkout URL for the selected provider
    const paymeUrl = generatePaymeCheckoutUrl({ orderId, amountUzs, returnUrl });
    const clickUrl = generateClickCheckoutUrl({ orderId, amountUzs, returnUrl });

    return res.status(201).json({
      order: {
        id: orderId,
        planId: plan.id,
        planName: plan.name,
        billingCycle,
        amountUzs,
        amountUsd,
        minutesCredited,
        provider,
        status: 'pending',
      },
      paymentUrls: {
        payme: paymeUrl,
        click: clickUrl,
        selected: provider === 'click' ? clickUrl : paymeUrl,
      },
      message: 'Checkout order created successfully.',
    });
  } catch (err) {
    console.error('Error creating checkout order:', err);
    return res.status(500).json({ error: 'Failed to create payment order.' });
  }
});

// 3. GET USER ORDERS HISTORY & SUBSCRIPTION INFO (Protected)
paymentsRouter.get('/orders', authenticateToken, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT * FROM orders
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id);

    const user = userRepository.findById(req.user.id);

    return res.json({
      orders,
      subscription: {
        plan: user?.plan || 'free',
        minutesBalance: user?.minutes_balance || 5.0,
        subscriptionExpiresAt: user?.subscription_expires_at || null,
      },
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    return res.status(500).json({ error: 'Failed to fetch user orders.' });
  }
});

// 4. GET SINGLE ORDER STATUS (Protected)
paymentsRouter.get('/orders/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, req.user.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const user = userRepository.findById(req.user.id);

    return res.json({
      order,
      subscription: {
        plan: user?.plan || 'free',
        minutesBalance: user?.minutes_balance || 5.0,
        subscriptionExpiresAt: user?.subscription_expires_at || null,
      },
    });
  } catch (err) {
    console.error('Error fetching order status:', err);
    return res.status(500).json({ error: 'Failed to fetch order status.' });
  }
});

// 5. SIMULATE TEST PAYMENT SUCCESS (Protected, For dev & local demo testing)
paymentsRouter.post('/simulate-success', authenticateToken, (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required.' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, req.user.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status === 'completed') {
      return res.json({ message: 'Order is already completed.', order });
    }

    // Mark order completed
    db.prepare(`UPDATE orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(order.id);

    // Credit user subscription and minutes
    const planTier = order.plan_id === 'pro' ? 'pro' : (order.plan_id === 'creator' ? 'creator' : 'free');
    const updatedUser = userRepository.creditSubscription(order.user_id, {
      plan: planTier,
      minutesToAdd: order.minutes_credited,
      durationDays: order.billing_cycle === 'yearly' ? 365 : 30,
    });

    return res.json({
      message: `🎉 Payment successful! ${order.minutes_credited} minutes added to your account.`,
      order: { ...order, status: 'completed' },
      user: userRepository.formatUser(updatedUser),
    });
  } catch (err) {
    console.error('Error simulating payment:', err);
    return res.status(500).json({ error: 'Failed to simulate payment.' });
  }
});

// 6. PAYME MERCHANT WEBHOOK (Public JSON-RPC 2.0 with Basic Auth)
paymentsRouter.post('/payme', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!verifyPaymeAuth(authHeader)) {
      return res.status(200).json({
        error: { code: -32504, message: 'Access denied. Invalid Payme merchant secret.' },
        id: req.body?.id || null,
      });
    }

    const result = await handlePaymeRpc(req.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Payme webhook error:', err);
    return res.status(200).json({
      error: { code: -32300, message: err.message || 'Payme RPC error.' },
      id: req.body?.id || null,
    });
  }
});

// 7. CLICK PREPARE WEBHOOK (Public SHOP API)
paymentsRouter.post('/click/prepare', async (req, res) => {
  try {
    const params = { ...req.query, ...req.body };
    const response = await handleClickPrepare(params);
    return res.json(response);
  } catch (err) {
    console.error('Click prepare error:', err);
    return res.json({ error: -8, error_note: 'Internal server error' });
  }
});

// 8. CLICK COMPLETE WEBHOOK (Public SHOP API)
paymentsRouter.post('/click/complete', async (req, res) => {
  try {
    const params = { ...req.query, ...req.body };
    const response = await handleClickComplete(params);
    return res.json(response);
  } catch (err) {
    console.error('Click complete error:', err);
    return res.json({ error: -8, error_note: 'Internal server error' });
  }
});
