import { config } from '../config.js';
import { createCheckoutLink } from '../services/infinitePayService.js';
import { createPendingOrder } from '../services/vipService.js';
import { readDb } from '../services/jsonDatabase.js';

function assertDiscordAuth(request, reply) {
  const token = request.headers['x-discord-token'];
  if (!token || token !== config.discordSharedToken) {
    reply.code(401).send({ error: 'Unauthorized Discord client.' });
    return false;
  }
  return true;
}

export async function discordRoutes(fastify) {
  fastify.get('/discord/link-status', async (request, reply) => {
    if (!assertDiscordAuth(request, reply)) return;

    const { serverType, discordId } = request.query;
    if (!serverType || !discordId) {
      return reply.code(400).send({ error: 'serverType and discordId are required.' });
    }

    const db = await readDb(serverType);
    const user = db.users[discordId];

    return {
      linked: Boolean(user?.steamId64),
      steamId64: user?.steamId64 || null,
      vipType: user?.vipType || null,
      expirationDate: user?.expirationDate || null
    };
  });

  fastify.post('/discord/create-checkout', async (request, reply) => {
    if (!assertDiscordAuth(request, reply)) return;

    const { serverType, discordId, vipType } = request.body;
    if (!serverType || !discordId || !['vip', 'vip+'].includes(vipType)) {
      return reply.code(400).send({ error: 'Invalid payload.' });
    }

    const db = await readDb(serverType);
    const user = db.users[discordId];

    if (!user?.steamId64) {
      return reply.code(400).send({ error: 'Steam account not linked for this user.' });
    }

    const order = await createPendingOrder({ serverType, discordId, vipType });

    const checkout = await createCheckoutLink({
      orderNsu: order.orderNsu,
      productName: `${vipType.toUpperCase()} - ${serverType.toUpperCase()} Rust Server`,
      priceCents: order.priceCents,
      metadata: {
        serverType,
        discordId,
        steamId64: user.steamId64,
        vipType
      }
    });

    return reply.send({
      orderNsu: order.orderNsu,
      paymentStatus: order.paymentStatus,
      checkoutUrl: checkout?.url || checkout?.checkout_url || checkout?.data?.url
    });
  });
}
