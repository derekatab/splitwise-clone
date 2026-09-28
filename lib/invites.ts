import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendInviteEmail } from '@/lib/email';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Trims and lower-cases an email so lookups are case-insensitive. Returns null for empty input. */
export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function buildInviteUrl(token: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${baseUrl}/auth/join?token=${token}`;
}

/**
 * Creates a DeviceInvite for the trip and emails the join link.
 * Throws if the email cannot be sent (the invite row is still created).
 */
export async function createAndSendTripInvite(tripId: string, email: string, tripName: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const inviteUrl = buildInviteUrl(token);

  const invite = await prisma.deviceInvite.create({
    data: {
      tripId,
      inviteUrl,
      email,
      expiresAt: new Date(Date.now() + ONE_YEAR_MS),
    },
  });

  await sendInviteEmail(email, inviteUrl, tripName);
  return invite;
}
