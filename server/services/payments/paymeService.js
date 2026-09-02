import { randomUUID } from 'crypto';
import { db } from '../../db.js';
import * as userRepository from '../../repositories/userRepository.js';

// Payme Error Codes
export const PaymeError = {
  TRANSPORT_ERROR: -32300,
  ACCESS_DENIED: -32504,
  PARSE_ERROR: -32700,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  ORDER_NOT_FOUND: -31050,
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  UNABLE_TO_PERFORM_OPERATION: -31008,
  ALREADY_DONE: -31060,
  PENDING_TRANSACTION_EXISTS: -31099,
};

// 12 hours timeout for pending transactions
const TRANSACTION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

export function verifyPaymeAuth(authHeader) {
  const secretKey = process.env.PAYME_SECRET_KEY || 'dubbing_payme_test_secret_key_2026';
  const testSecretKey = process.env.PAYME_TEST_SECRET_KEY || secretKey;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const encoded = authHeader.replace('Basic ', '').trim();
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const [username, password] = decoded.split(':');

  if (username !== 'Paycom') {
    return false;
  }

  return password === secretKey || password === testSecretKey;
}

export function generatePaymeCheckoutUrl({ orderId, amountUzs, returnUrl }) {
  const merchantId = process.env.PAYME_MERCHANT_ID || '66d5a1b2c3d4e5f6a7b8c9d0';
  const amountTiyin = Math.round(amountUzs * 100);
  const isTest = process.env.PAYME_TEST_MODE !== 'false';

  const baseUrl = isTest ? 'https://test.paycom.uz' : 'https://checkout.paycom.uz';
  
  // Format: m=MERCHANT_ID;ac.order_id=ORDER_ID;a=AMOUNT_TIYIN;c=RETURN_URL
  const paramsStr = `m=${merchantId};ac.order_id=${orderId};a=${amountTiyin}${returnUrl ? `;c=${encodeURIComponent(returnUrl)}` : ''}`;
  const base64Params = Buffer.from(paramsStr).toString('base64');

  return `${baseUrl}/${base64Params}`;
}

export async function handlePaymeRpc(requestBody) {
  const { id, method, params } = requestBody;

  if (!method || !params) {
    return {
      error: { code: PaymeError.INVALID_PARAMS, message: 'Invalid RPC parameters.' },
      id: id || null,
    };
  }

  try {
    switch (method) {
      case 'CheckPerformTransaction':
        return await checkPerformTransaction(id, params);
      case 'CreateTransaction':
        return await createTransaction(id, params);
      case 'PerformTransaction':
        return await performTransaction(id, params);
      case 'CancelTransaction':
        return await cancelTransaction(id, params);
      case 'CheckTransaction':
        return await checkTransaction(id, params);
      case 'GetStatement':
        return await getStatement(id, params);
      default:
        return {
          error: { code: PaymeError.METHOD_NOT_FOUND, message: 'RPC method not supported.' },
          id,
        };
    }
  } catch (err) {
    console.error('Payme RPC handler error:', err);
    return {
      error: { code: PaymeError.TRANSPORT_ERROR, message: err.message || 'Internal error' },
      id,
    };
  }
}

async function checkPerformTransaction(id, params) {
  const orderId = params.account?.order_id;
  const amountTiyin = params.amount;

  if (!orderId) {
    return { error: { code: PaymeError.ORDER_NOT_FOUND, message: { uz: 'Buyurtma topilmadi', en: 'Order not found' } }, id };
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return { error: { code: PaymeError.ORDER_NOT_FOUND, message: { uz: 'Buyurtma topilmadi', en: 'Order not found' } }, id };
  }

  const expectedTiyin = Math.round(order.amount_uzs * 100);
  if (amountTiyin !== expectedTiyin) {
    return { error: { code: PaymeError.INVALID_AMOUNT, message: { uz: 'Miqdor notogri', en: 'Incorrect amount' } }, id };
  }

  if (order.status === 'completed') {
    return { error: { code: PaymeError.ALREADY_DONE, message: { uz: 'Buyurtma tolangandir', en: 'Order already paid' } }, id };
  }

  return {
    result: {
      allow: true,
    },
    id,
  };
}

async function createTransaction(id, params) {
  const paymeTransId = params.id;
  const orderId = params.account?.order_id;
  const amountTiyin = params.amount;
  const time = params.time;

  // 1. Check if transaction already exists for this payme_id
  const existingTrans = db.prepare('SELECT * FROM payme_transactions WHERE payme_id = ?').get(paymeTransId);

  if (existingTrans) {
    if (existingTrans.state === 1) {
      // Check timeout
      if (Date.now() - existingTrans.create_time > TRANSACTION_TIMEOUT_MS) {
        db.prepare('UPDATE payme_transactions SET state = -1, reason = 4, cancel_time = ? WHERE id = ?')
          .run(Date.now(), existingTrans.id);
        return {
          error: { code: PaymeError.UNABLE_TO_PERFORM_OPERATION, message: 'Transaction timed out' },
          id,
        };
      }

      return {
        result: {
          create_time: existingTrans.create_time,
          transaction: existingTrans.payme_id,
          state: existingTrans.state,
        },
        id,
      };
    }

    return {
      result: {
        create_time: existingTrans.create_time,
        transaction: existingTrans.payme_id,
        state: existingTrans.state,
      },
      id,
    };
  }

  // 2. Validate order
  const checkRes = await checkPerformTransaction(id, params);
  if (checkRes.error) {
    return checkRes;
  }

  // 3. Check if another active transaction exists for this order
  const pendingForOrder = db.prepare('SELECT * FROM payme_transactions WHERE order_id = ? AND state = 1').get(orderId);
  if (pendingForOrder) {
    return {
      error: { code: PaymeError.PENDING_TRANSACTION_EXISTS, message: 'Another transaction in progress' },
      id,
    };
  }

  // 4. Create new transaction record
  const transId = randomUUID();
  const createTime = time || Date.now();

  db.prepare(`
    INSERT INTO payme_transactions (id, payme_id, order_id, amount, state, create_time)
    VALUES (?, ?, ?, ?, 1, ?)
  `).run(transId, paymeTransId, orderId, amountTiyin, createTime);

  return {
    result: {
      create_time: createTime,
      transaction: paymeTransId,
      state: 1,
    },
    id,
  };
}

async function performTransaction(id, params) {
  const paymeTransId = params.id;
  const trans = db.prepare('SELECT * FROM payme_transactions WHERE payme_id = ?').get(paymeTransId);

  if (!trans) {
    return {
      error: { code: PaymeError.TRANSACTION_NOT_FOUND, message: 'Transaction not found' },
      id,
    };
  }

  if (trans.state === 1) {
    // Check timeout
    if (Date.now() - trans.create_time > TRANSACTION_TIMEOUT_MS) {
      db.prepare('UPDATE payme_transactions SET state = -1, reason = 4, cancel_time = ? WHERE id = ?')
        .run(Date.now(), trans.id);
      return {
        error: { code: PaymeError.UNABLE_TO_PERFORM_OPERATION, message: 'Transaction expired' },
        id,
      };
    }

    const performTime = Date.now();

    // Complete transaction
    db.prepare('UPDATE payme_transactions SET state = 2, perform_time = ? WHERE id = ?')
      .run(performTime, trans.id);

    // Update order status
    db.prepare(`UPDATE orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(trans.order_id);

    // Credit user subscription and minutes!
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(trans.order_id);
    if (order) {
      const planTier = order.plan_id === 'pro' ? 'pro' : (order.plan_id === 'creator' ? 'creator' : 'free');
      userRepository.creditSubscription(order.user_id, {
        plan: planTier,
        minutesToAdd: order.minutes_credited,
        durationDays: order.billing_cycle === 'yearly' ? 365 : 30,
      });
    }

    return {
      result: {
        transaction: trans.payme_id,
        perform_time: performTime,
        state: 2,
      },
      id,
    };
  }

  if (trans.state === 2) {
    return {
      result: {
        transaction: trans.payme_id,
        perform_time: trans.perform_time,
        state: trans.state,
      },
      id,
    };
  }

  return {
    error: { code: PaymeError.UNABLE_TO_PERFORM_OPERATION, message: 'Cannot perform cancelled transaction' },
    id,
  };
}

async function cancelTransaction(id, params) {
  const paymeTransId = params.id;
  const reason = params.reason || 1;
  const trans = db.prepare('SELECT * FROM payme_transactions WHERE payme_id = ?').get(paymeTransId);

  if (!trans) {
    return {
      error: { code: PaymeError.TRANSACTION_NOT_FOUND, message: 'Transaction not found' },
      id,
    };
  }

  const cancelTime = Date.now();

  if (trans.state === 1) {
    db.prepare('UPDATE payme_transactions SET state = -1, cancel_time = ?, reason = ? WHERE id = ?')
      .run(cancelTime, reason, trans.id);
    db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`)
      .run(trans.order_id);

    return {
      result: {
        transaction: trans.payme_id,
        cancel_time: cancelTime,
        state: -1,
      },
      id,
    };
  }

  if (trans.state === 2) {
    db.prepare('UPDATE payme_transactions SET state = -2, cancel_time = ?, reason = ? WHERE id = ?')
      .run(cancelTime, reason, trans.id);
    db.prepare(`UPDATE orders SET status = 'refunded' WHERE id = ?`)
      .run(trans.order_id);

    return {
      result: {
        transaction: trans.payme_id,
        cancel_time: cancelTime,
        state: -2,
      },
      id,
    };
  }

  return {
    result: {
      transaction: trans.payme_id,
      cancel_time: trans.cancel_time,
      state: trans.state,
    },
    id,
  };
}

async function checkTransaction(id, params) {
  const paymeTransId = params.id;
  const trans = db.prepare('SELECT * FROM payme_transactions WHERE payme_id = ?').get(paymeTransId);

  if (!trans) {
    return {
      error: { code: PaymeError.TRANSACTION_NOT_FOUND, message: 'Transaction not found' },
      id,
    };
  }

  return {
    result: {
      create_time: trans.create_time,
      perform_time: trans.perform_time || 0,
      cancel_time: trans.cancel_time || 0,
      transaction: trans.payme_id,
      state: trans.state,
      reason: trans.reason || null,
    },
    id,
  };
}

async function getStatement(id, params) {
  const { from, to } = params;
  const transactions = db.prepare(`
    SELECT * FROM payme_transactions
    WHERE create_time >= ? AND create_time <= ?
    ORDER BY create_time ASC
  `).all(from || 0, to || Date.now());

  return {
    result: {
      transactions: transactions.map((t) => ({
        id: t.payme_id,
        time: t.create_time,
        amount: t.amount,
        account: { order_id: t.order_id },
        create_time: t.create_time,
        perform_time: t.perform_time || 0,
        cancel_time: t.cancel_time || 0,
        transaction: t.payme_id,
        state: t.state,
        reason: t.reason || null,
      })),
    },
    id,
  };
}
