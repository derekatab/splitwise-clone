import { NextRequest, NextResponse } from 'next/server';
import type { Trip, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Resolves the current user from the deviceId cookie.
 * Returns null when there is no cookie or the device is unknown.
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  const deviceId = request.cookies.get('deviceId')?.value;
  if (!deviceId) return null;

  const device = await prisma.device.findUnique({
    where: { deviceId },
    include: { user: true },
  });

  return device?.user ?? null;
}

export type TripAdminResult =
  | { ok: true; user: User; trip: Trip }
  | { ok: false; response: NextResponse };

/**
 * Loads the trip and checks that the current user is its admin (the creator).
 * On failure, returns a ready-to-send error response.
 */
export async function requireTripAdmin(request: NextRequest, tripId: string): Promise<TripAdminResult> {
  const user = await getCurrentUser(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    return { ok: false, response: NextResponse.json({ error: 'Trip not found' }, { status: 404 }) };
  }

  if (trip.createdBy !== user.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Only the trip admin can manage members' }, { status: 403 }),
    };
  }

  return { ok: true, user, trip };
}
