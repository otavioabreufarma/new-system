import path from 'node:path';

const required = [
  'BACKEND_PUBLIC_URL',
  'STEAM_API_KEY',
  'STEAM_OPENID_REALM',
  'INFINITEPAY_API_KEY',
  'INFINITEPAY_SELLER_HANDLE',
  'INFINITEPAY_WEBHOOK_SECRET',
  'PLUGIN_SHARED_TOKEN',
  'DISCORD_SHARED_TOKEN',
  'REDIRECT_AFTER_PAYMENT'
];

for (const key of required) {
  if (!process.env[key]) {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] Missing env var ${key}. Configure before production usage.`);
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL || 'http://localhost:3000',
  steamApiKey: process.env.STEAM_API_KEY || '',
  steamOpenIdRealm: process.env.STEAM_OPENID_REALM || 'http://localhost:3000',
  infinitePayApiKey: process.env.INFINITEPAY_API_KEY || '',
  infinitePaySellerHandle: process.env.INFINITEPAY_SELLER_HANDLE || '',
  infinitePayWebhookSecret: process.env.INFINITEPAY_WEBHOOK_SECRET || '',
  pluginSharedToken: process.env.PLUGIN_SHARED_TOKEN || '',
  discordSharedToken: process.env.DISCORD_SHARED_TOKEN || '',
  redirectAfterPayment: process.env.REDIRECT_AFTER_PAYMENT || 'https://discord.com/channels/@me',
  databaseDir: path.resolve(process.cwd(), 'database')
};

export const SERVER_TYPES = ['solo', 'duo'];
