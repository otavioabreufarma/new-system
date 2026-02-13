import Fastify from 'fastify';
import { config } from './config.js';
import { ensureDatabases } from './services/jsonDatabase.js';
import { authRoutes } from './routes/authRoutes.js';
import { discordRoutes } from './routes/discordRoutes.js';
import { webhookRoutes } from './routes/webhookRoutes.js';
import { pluginRoutes } from './routes/pluginRoutes.js';

const app = Fastify({ logger: true });

app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    req.rawBody = body;
    done(null, JSON.parse(body));
  } catch (error) {
    done(error, undefined);
  }
});

app.get('/health', async () => ({ status: 'ok' }));

await ensureDatabases();
await app.register(authRoutes);
await app.register(discordRoutes);
await app.register(webhookRoutes);
await app.register(pluginRoutes);

app.listen({ port: config.port, host: config.host })
  .then(() => app.log.info(`Backend online at ${config.host}:${config.port}`))
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
