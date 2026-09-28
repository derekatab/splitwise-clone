import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildInviteUrl, normalizeEmail } from '@/lib/invites';

/**
 * GET /api/invites/lookup?token=...
 * Returns the email and trip an invite link is for, so the join page can prefill it.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 400 });
    }

    const invite = await prisma.deviceInvite.findUnique({
      where: { inviteUrl: buildInviteUrl(token) },
    });
    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    const email = normalizeEmail(invite.email);
    const [trip, existingUser] = await Promise.all([
      invite.tripId
        ? prisma.trip.findUnique({ where: { id: invite.tripId }, select: { name: true } })
        : Promise.resolve(null),
      email
        ? prisma.user.findUnique({ where: { email }, select: { name: true } })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      email,
      name: existingUser?.name ?? null,
      tripName: trip?.name ?? null,
      accepted: invite.accepted,
    });
  } catch (error) {
    console.error('Invite lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up invite' }, { status: 500 });
  }
}
