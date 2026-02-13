import crypto from 'node:crypto';
import { config } from '../config.js';

const INFINITEPAY_BASE_URL = 'https://api.infinitepay.io';

export async function createCheckoutLink({ orderNsu, productName, priceCents, metadata }) {
  const response = await fetch(`${INFINITEPAY_BASE_URL}/invoices/public/checkout/links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.infinitePayApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      handle: config.infinitePaySellerHandle,
      price: priceCents,
      order_nsu: orderNsu,
      items: [{
        description: productName,
        quantity: 1,
        price: priceCents
      }],
      redirect_url: config.redirectAfterPayment,
      webhook_url: `${config.backendPublicUrl}/webhooks/infinitepay`,
      metadata
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`InfinitePay checkout creation failed: ${response.status} ${errorBody}`);
  }

  return response.json();
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!config.infinitePayWebhookSecret) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', config.infinitePayWebhookSecret)
    .update(rawBody)
    .digest('hex');

  return expected === signatureHeader;
}
