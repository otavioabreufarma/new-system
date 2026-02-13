import { verifyWebhookSignature } from '../services/infinitePayService.js';
import { markOrderPaid } from '../services/vipService.js';

export async function webhookRoutes(fastify) {
  fastify.post('/webhooks/infinitepay', async (request, reply) => {
    const signature = request.headers['x-infinitepay-signature'] || '';
    const rawBody = request.rawBody || JSON.stringify(request.body || {});

    if (!verifyWebhookSignature(rawBody, String(signature))) {
      return reply.code(401).send({ error: 'Invalid webhook signature.' });
    }

    const event = request.body;
    const orderNsu = event?.order_nsu || event?.data?.order_nsu;
    const serverType = event?.metadata?.serverType || event?.data?.metadata?.serverType;
    const transactionId = event?.transaction_id || event?.data?.transaction_id || 'unknown';
    const status = event?.status || event?.data?.status;

    if (!orderNsu || !serverType) {
      return reply.code(400).send({ error: 'Invalid webhook payload.' });
    }

    if (status === 'paid' || status === 'approved' || status === 'success') {
      await markOrderPaid({ serverType, orderNsu, transactionId });
    }

    return reply.send({ received: true });
  });
}
