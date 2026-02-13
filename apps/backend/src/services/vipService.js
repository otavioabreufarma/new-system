import crypto from 'node:crypto';
import { updateDb, readDb } from './jsonDatabase.js';

const PLAN_DURATION_DAYS = {
  vip: 30,
  'vip+': 30
};

export const PLAN_PRICES = {
  vip: 2990,
  'vip+': 4990
};

export function generateOrderNsu() {
  return `vip-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function upsertSteamLink({ serverType, discordId, steamId64 }) {
  return updateDb(serverType, (db) => {
    const current = db.users[discordId] || {
      discordId,
      steamId64: null,
      vipType: null,
      startDate: null,
      expirationDate: null,
      paymentStatus: null,
      purchaseHistory: []
    };

    db.users[discordId] = {
      ...current,
      steamId64
    };

    return db;
  });
}

export async function createPendingOrder({ serverType, discordId, vipType }) {
  const orderNsu = generateOrderNsu();
  const order = {
    orderNsu,
    discordId,
    vipType,
    priceCents: PLAN_PRICES[vipType],
    createdAt: new Date().toISOString(),
    paymentStatus: 'pending'
  };

  await updateDb(serverType, (db) => {
    db.orders[orderNsu] = order;
    return db;
  });

  return order;
}

export async function markOrderPaid({ serverType, orderNsu, transactionId }) {
  return updateDb(serverType, (db) => {
    const order = db.orders[orderNsu];
    if (!order) {
      return db;
    }

    order.paymentStatus = 'paid';
    order.transactionId = transactionId;
    order.paidAt = new Date().toISOString();

    const user = db.users[order.discordId];
    if (!user?.steamId64) {
      return db;
    }

    const durationDays = PLAN_DURATION_DAYS[order.vipType] ?? 30;
    const now = new Date();
    const startDate = user.expirationDate && new Date(user.expirationDate) > now
      ? new Date(user.expirationDate)
      : now;

    const expirationDate = new Date(startDate);
    expirationDate.setDate(expirationDate.getDate() + durationDays);

    user.vipType = order.vipType;
    user.startDate = now.toISOString();
    user.expirationDate = expirationDate.toISOString();
    user.paymentStatus = 'paid';

    const historyEntry = {
      orderNsu,
      vipType: order.vipType,
      priceCents: order.priceCents,
      paidAt: order.paidAt,
      transactionId
    };

    user.purchaseHistory = user.purchaseHistory || [];
    user.purchaseHistory.push(historyEntry);
    db.purchaseHistory.push({ discordId: user.discordId, steamId64: user.steamId64, ...historyEntry });

    return db;
  });
}

export async function getVipStatusBySteamId({ serverType, steamId64 }) {
  const db = await readDb(serverType);
  const user = Object.values(db.users).find((candidate) => candidate.steamId64 === steamId64);

  if (!user || !user.expirationDate) {
    return { active: false, vipType: null, expirationDate: null };
  }

  const isActive = new Date(user.expirationDate) > new Date();
  return {
    active: isActive,
    vipType: isActive ? user.vipType : null,
    expirationDate: user.expirationDate,
    discordId: user.discordId
  };
}
