import { buildSteamAuthUrl, extractSteamId64, validateSteamAccount, verifySteamOpenId } from '../services/steamService.js';
import { upsertSteamLink } from '../services/vipService.js';

export async function authRoutes(fastify) {
  fastify.get('/auth/steam/start', async (request, reply) => {
    const { discordId, serverType } = request.query;

    if (!discordId || !serverType) {
      return reply.code(400).send({ error: 'discordId and serverType are required.' });
    }

    const authUrl = buildSteamAuthUrl({ discordId, serverType });
    return reply.send({ authUrl });
  });

  fastify.get('/auth/steam/callback', async (request, reply) => {
    const isValidAssertion = await verifySteamOpenId(request.query);
    if (!isValidAssertion) {
      return reply.code(401).send({ error: 'Steam OpenID validation failed.' });
    }

    const state = request.query.state ? JSON.parse(Buffer.from(request.query.state, 'base64url').toString('utf-8')) : null;
    const claimedId = request.query['openid.claimed_id'];
    const steamId64 = extractSteamId64(claimedId || '');

    if (!state?.discordId || !state?.serverType || !steamId64) {
      return reply.code(400).send({ error: 'Invalid callback payload.' });
    }

    const accountValidation = await validateSteamAccount(steamId64);
    if (!accountValidation.valid) {
      return reply.code(400).send({ error: accountValidation.reason });
    }

    await upsertSteamLink({
      serverType: state.serverType,
      discordId: state.discordId,
      steamId64
    });

    return reply.type('text/html').send(`
      <html>
        <body style="font-family:Arial;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;">
          <div style="max-width:500px;background:#1e293b;padding:24px;border-radius:12px;text-align:center;">
            <h2>Steam vinculada com sucesso ✅</h2>
            <p>SteamID: <strong>${steamId64}</strong></p>
            <p>Volte para o Discord e continue a compra do VIP.</p>
          </div>
        </body>
      </html>
    `);
  });
}
