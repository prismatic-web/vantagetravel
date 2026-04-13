import { Env } from './types';
import { verifyAuth } from './auth';
import { generateSecureId } from './crypto';

// ============================================================================
// STRIPE PAYMENT PROCESSING - SERVER SIDE ONLY
// All sensitive Stripe operations happen on the backend
// ============================================================================

/**
 * Create Stripe Checkout Session for subscription
 */
export async function handleCreateCheckout(env: Env, request: Request): Promise<Response> {
  const auth = await verifyAuth(env, request);
  
  if (!auth) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }
  
  // Get user info
  const user = await env.DB.prepare(
    'SELECT email, name FROM users WHERE id = ?'
  ).bind(auth.userId).first<{ email: string; name: string }>();
  
  if (!user) {
    return jsonResponse({ error: 'User not found' }, 404);
  }
  
  // Check if user already has a Stripe customer
  const existingSub = await env.DB.prepare(
    'SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?'
  ).bind(auth.userId).first<{ stripe_customer_id: string | null }>();
  
  let customerId = existingSub?.stripe_customer_id;
  
  // Create customer if doesn't exist
  if (!customerId) {
    const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: user.email,
        name: user.name,
        metadata: JSON.stringify({ user_id: auth.userId }),
      }),
    });
    
    if (!customerResponse.ok) {
      const error = await customerResponse.text();
      console.error('Stripe customer creation failed:', error);
      return jsonResponse({ error: 'Failed to create customer' }, 500);
    }
    
    const customer = await customerResponse.json() as { id: string };
    customerId = customer.id;
    
    // Store customer ID
    await env.DB.prepare(
      'UPDATE subscriptions SET stripe_customer_id = ?, updated_at = ? WHERE user_id = ?'
    ).bind(customerId, Math.floor(Date.now() / 1000), auth.userId).run();
  }
  
  // Create checkout session
  const checkoutResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: customerId,
      'line_items[0][price]': env.STRIPE_PRICE_ID,
      'line_items[0][quantity]': '1',
      mode: 'subscription',
      success_url: `${env.APP_URL}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/premium/cancel`,
      'subscription_data[metadata][user_id]': auth.userId,
    }),
  });
  
  if (!checkoutResponse.ok) {
    const error = await checkoutResponse.text();
    console.error('Stripe checkout creation failed:', error);
    return jsonResponse({ error: 'Failed to create checkout session' }, 500);
  }
  
  const session = await checkoutResponse.json() as { url: string };
  
  return jsonResponse({ url: session.url });
}

/**
 * Handle Stripe Webhooks
 * Verifies signature and processes events
 */
export async function handleStripeWebhook(env: Env, request: Request): Promise<Response> {
  const payload = await request.text();
  const signature = request.headers.get('Stripe-Signature');
  
  if (!signature) {
    return jsonResponse({ error: 'Missing signature' }, 400);
  }
  
  // Verify webhook signature
  const isValid = await verifyWebhookSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return jsonResponse({ error: 'Invalid signature' }, 400);
  }
  
  const event = JSON.parse(payload);
  
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(env, event.data.object);
      break;
      
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(env, event.data.object);
      break;
      
    case 'invoice.payment_failed':
      await handlePaymentFailed(env, event.data.object);
      break;
      
    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(env, event.data.object);
      break;
      
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(env, event.data.object);
      break;
  }
  
  return jsonResponse({ received: true });
}

/**
 * Handle successful checkout
 */
async function handleCheckoutCompleted(env: Env, session: {
  subscription: string;
  customer: string;
  metadata: { user_id?: string };
}): Promise<void> {
  const userId = session.metadata?.user_id;
  if (!userId) return;
  
  const now = Math.floor(Date.now() / 1000);
  
  // Get subscription details from Stripe
  const subResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  
  if (!subResponse.ok) return;
  
  const subscription = await subResponse.json() as {
    status: string;
    current_period_start: number;
    current_period_end: number;
  };
  
  // Update subscription in database
  await env.DB.prepare(
    `UPDATE subscriptions 
     SET stripe_subscription_id = ?, 
         status = ?, 
         tier = 'pro',
         current_period_start = ?,
         current_period_end = ?,
         updated_at = ?
     WHERE user_id = ?`
  ).bind(
    session.subscription,
    subscription.status,
    subscription.current_period_start,
    subscription.current_period_end,
    now,
    userId
  ).run();
  
  // Log the event
  await logPaymentEvent(env, userId, 'subscription_created', session.subscription);
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(env: Env, invoice: {
  subscription: string;
  customer: string;
}): Promise<void> {
  // Update subscription period
  const subResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${invoice.subscription}`, {
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  
  if (!subResponse.ok) return;
  
  const subscription = await subResponse.json() as {
    current_period_start: number;
    current_period_end: number;
  };
  
  const now = Math.floor(Date.now() / 1000);
  
  await env.DB.prepare(
    `UPDATE subscriptions 
     SET current_period_start = ?,
         current_period_end = ?,
         status = 'active',
         updated_at = ?
     WHERE stripe_subscription_id = ?`
  ).bind(
    subscription.current_period_start,
    subscription.current_period_end,
    now,
    invoice.subscription
  ).run();
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(env: Env, invoice: {
  subscription: string;
  customer: string;
}): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  await env.DB.prepare(
    'UPDATE subscriptions SET status = ?, updated_at = ? WHERE stripe_subscription_id = ?'
  ).bind('past_due', now, invoice.subscription).run();
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(env: Env, subscription: {
  id: string;
}): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  await env.DB.prepare(
    'UPDATE subscriptions SET status = ?, tier = ?, updated_at = ? WHERE stripe_subscription_id = ?'
  ).bind('canceled', 'free', now, subscription.id).run();
}

/**
 * Handle subscription update
 */
async function handleSubscriptionUpdated(env: Env, subscription: {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
}): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  await env.DB.prepare(
    `UPDATE subscriptions 
     SET status = ?,
         current_period_start = ?,
         current_period_end = ?,
         updated_at = ?
     WHERE stripe_subscription_id = ?`
  ).bind(
    subscription.status,
    subscription.current_period_start,
    subscription.current_period_end,
    now,
    subscription.id
  ).run();
}

/**
 * Verify Stripe webhook signature
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(',');
  const timestamps: number[] = [];
  const signatures: string[] = [];
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key.trim() === 't') {
      timestamps.push(parseInt(value, 10));
    } else if (key.trim() === 'v1') {
      signatures.push(value);
    }
  }
  
  if (timestamps.length === 0 || signatures.length === 0) {
    return false;
  }
  
  const timestamp = timestamps[0];
  
  // Check timestamp (reject if older than 5 minutes)
  if (Math.floor(Date.now() / 1000) - timestamp > 300) {
    return false;
  }
  
  // Verify signature
  const encoder = new TextEncoder();
  const signedPayload = `${timestamp}.${payload}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedSigHex = Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return signatures.some(sig => timingSafeEqual(sig, expectedSigHex));
}

/**
 * Get user's subscription status
 */
export async function handleGetSubscription(env: Env, request: Request): Promise<Response> {
  const auth = await verifyAuth(env, request);
  
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  
  const subscription = await env.DB.prepare(
    `SELECT status, tier, current_period_end, stripe_subscription_id 
     FROM subscriptions 
     WHERE user_id = ?`
  ).bind(auth.userId).first();
  
  if (!subscription) {
    return jsonResponse({ 
      status: 'active', 
      tier: 'free',
      features: getTierFeatures('free')
    });
  }
  
  return jsonResponse({
    ...subscription,
    isPremium: subscription.tier === 'pro',
    features: getTierFeatures(subscription.tier as string),
  });
}

/**
 * Cancel subscription
 */
export async function handleCancelSubscription(env: Env, request: Request): Promise<Response> {
  const auth = await verifyAuth(env, request);
  
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  
  const subscription = await env.DB.prepare(
    'SELECT stripe_subscription_id FROM subscriptions WHERE user_id = ? AND tier = ?'
  ).bind(auth.userId, 'pro').first<{ stripe_subscription_id: string }>();
  
  if (!subscription?.stripe_subscription_id) {
    return jsonResponse({ error: 'No active subscription' }, 400);
  }
  
  // Cancel in Stripe (at period end)
  const cancelResponse = await fetch(
    `https://api.stripe.com/v1/subscriptions/${subscription.stripe_subscription_id}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        cancel_at_period_end: 'true',
      }),
    }
  );
  
  if (!cancelResponse.ok) {
    return jsonResponse({ error: 'Failed to cancel subscription' }, 500);
  }
  
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    'UPDATE subscriptions SET status = ?, updated_at = ? WHERE user_id = ?'
  ).bind('canceled', now, auth.userId).run();
  
  return jsonResponse({ success: true, message: 'Subscription will cancel at period end' });
}

// ============================================================================
// Helpers
// ============================================================================

function getTierFeatures(tier: string): string[] {
  switch (tier) {
    case 'pro':
      return [
        'Unlimited trip generations',
        'Advanced AI recommendations',
        'PDF export & share',
        'Priority support',
        'Custom packing lists',
        'Flight price tracking'
      ];
    default:
      return [
        '3 trip generations per month',
        'Basic recommendations',
        'Standard packing lists'
      ];
  }
}

async function logPaymentEvent(env: Env, userId: string, eventType: string, metadata: string): Promise<void> {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_log (user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?)'
    ).bind(userId, eventType, metadata, Math.floor(Date.now() / 1000)).run();
  } catch {
    // Silent fail
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
