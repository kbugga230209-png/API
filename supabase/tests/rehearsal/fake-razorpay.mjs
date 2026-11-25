// A scripted stand-in for api.razorpay.com used in test mode.
//
// No request leaves the machine: this is how the manual-payment and
// subscription flows are rehearsed without a Razorpay account, and without ever
// touching a live endpoint. Every call is recorded so assertions can check that
// the function sent the right amount, currency, plan and idempotency keys.

export class FakeRazorpay {
  constructor() {
    this.calls = [];
    this.routes = new Map();
    this.payment_counter = 0;
  }

  on(method, pathPrefix, handler) {
    this.routes.set(`${method} ${pathPrefix}`, handler);
    return this;
  }

  /** Default happy-path behaviour for the calls the functions make. */
  withDefaults() {
    this.on('POST', '/orders', (body) => ({
      status: 200,
      data: { id: `order_TEST${Date.now().toString(36)}`, amount: body.amount, currency: body.currency, status: 'created', receipt: body.receipt },
    }));
    this.on('POST', '/plans', (body) => ({
      status: 200,
      data: { id: `plan_TEST${Date.now().toString(36)}`, period: body.period, interval: 1, item: body.item },
    }));
    this.on('POST', '/subscriptions', (body) => ({
      status: 200,
      data: { id: `sub_TEST${Date.now().toString(36)}`, status: 'created', short_url: 'https://rzp.io/l/test', plan_id: body.plan_id, total_count: body.total_count },
    }));
    this.calls = [];
    return this;
  }

  fetch = async (url, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const path = new URL(url).pathname.replace('/v1', '');
    const rawBody = init.body ? JSON.parse(init.body) : undefined;
    this.calls.push({ method, path, body: rawBody, authorization: init.headers?.Authorization });

    // Longest matching prefix wins, so a specific route such as
    // /subscriptions/sub_1/cancel beats the general /subscriptions handler.
    let route = null;
    let bestLength = -1;
    for (const [key, handler] of this.routes) {
      const [routeMethod, prefix] = key.split(' ');
      if (routeMethod === method && path.startsWith(prefix) && prefix.length > bestLength) {
        route = handler;
        bestLength = prefix.length;
      }
    }
    if (!route) {
      return new Response(JSON.stringify({ error: { description: `no fake route for ${method} ${path}` } }), { status: 404 });
    }
    const result = route(rawBody, path) ?? { status: 200, data: {} };
    return new Response(JSON.stringify(result.data), { status: result.status });
  };

  respondWith(method, pathPrefix, status, data) {
    this.routes.set(`${method} ${pathPrefix}`, () => ({ status, data }));
    return this;
  }

  findCall(method, pathPrefix) {
    return this.calls.filter((call) => call.method === method && call.path.startsWith(pathPrefix));
  }
}

/** A captured Razorpay payment, shaped like the webhook payload entity. */
export function paymentEntity({ id = 'pay_TEST1', orderId, amount = 4900, currency = 'INR', status = 'captured' } = {}) {
  return {
    id,
    entity: 'payment',
    order_id: orderId,
    amount,
    currency,
    status,
    method: 'upi',
    error_description: null,
  };
}

export function webhookEvent(eventType, payload, createdAt = Math.floor(Date.now() / 1000)) {
  return { event: eventType, payload, created_at: createdAt, contains: [eventType.split('.')[0]] };
}
