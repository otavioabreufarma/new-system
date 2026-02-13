import { config } from '../config.js';
import { getVipStatusBySteamId } from '../services/vipService.js';

function assertPluginAuth(request, reply) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== config.pluginSharedToken) {
    reply.code(401).send({ error: 'Unauthorized plugin.' });
    return false;
  }
  return true;
}

export async function pluginRoutes(fastify) {
  fastify.get('/plugin/vip-status', async (request, reply) => {
    if (!assertPluginAuth(request, reply)) return;

    const { serverType, steamId64 } = request.query;

    if (!serverType || !steamId64) {
      return reply.code(400).send({ error: 'serverType and steamId64 are required.' });
    }

    const status = await getVipStatusBySteamId({ serverType, steamId64 });
    return reply.send(status);
  });
}
