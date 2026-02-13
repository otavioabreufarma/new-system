import crypto from 'node:crypto';
import { config } from '../config.js';

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';

export function buildSteamAuthUrl({ discordId, serverType }) {
  const state = Buffer.from(JSON.stringify({ discordId, serverType, nonce: crypto.randomUUID() })).toString('base64url');
  const returnTo = `${config.backendPublicUrl}/auth/steam/callback?state=${state}`;

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': config.steamOpenIdRealm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  });

  return `${STEAM_OPENID_URL}?${params.toString()}`;
}

export async function verifySteamOpenId(query) {
  const verification = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('openid.')) {
      verification.set(key, value);
    }
  }
  verification.set('openid.mode', 'check_authentication');

  const response = await fetch(STEAM_OPENID_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: verification.toString()
  });
  const text = await response.text();
  return text.includes('is_valid:true');
}

export function extractSteamId64(claimedId) {
  const match = claimedId.match(/\/id\/(\d+)$/) || claimedId.match(/\/openid\/id\/(\d+)$/);
  return match?.[1] || null;
}

export async function validateSteamAccount(steamId64) {
  const endpoint = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
  endpoint.searchParams.set('key', config.steamApiKey);
  endpoint.searchParams.set('steamids', steamId64);

  const response = await fetch(endpoint);
  if (!response.ok) {
    return { valid: false, reason: 'Steam Web API unavailable' };
  }

  const data = await response.json();
  const player = data?.response?.players?.[0];
  return player
    ? { valid: true, profile: { steamId: player.steamid, personaname: player.personaname } }
    : { valid: false, reason: 'Steam account not found' };
}
