import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDeviceId } from '@/lib/utils/deviceTracking';
import { logAuditTrailEntry } from '@/lib/utils/auditTrail';
import { buildInviteUrl, normalizeEmail } from '@/lib/invites';

export async function POST(request: NextRequest) {
  try {
    const { token, name, email } = await request.json();
    const deviceId = request.cookies.get('deviceId')?.value || generateDeviceId();

    // Find invite
    const invite = await prisma.deviceInvite.findUnique({
      where: { inviteUrl: buildInviteUrl(token) },
    });

    if (!invite || invite.accepted) {
      return NextResponse.json(
        { error: 'Invalid or already used invite' },
        { status: 404 }
      );
    }

    // The invite pins the account email so the invited person lands on the account the
    // admin set up for them (e.g. as trip admin). Older invites without an email fall back
    // to the address typed on the join page.
    const accountEmail = normalizeEmail(invite.email) || normalizeEmail(email);
    const displayName = typeof name === 'string' ? name.trim() : '';

    if (!accountEmail || !displayName) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Create or get user
    const user = await prisma.user.upsert({
      where: { email: accountEmail },
      update: { name: displayName },
      create: { email: accountEmail, name: displayName },
    });

    // Create device for this login
    await prisma.device.upsert({
      where: { deviceId },
      update: { lastUsedAt: new Date() },
      create: {
        deviceId,
        userId: user.id,
      },
    });

    // Add user to trip (device-setup invites carry no trip)
    if (invite.tripId) {
      await prisma.tripMember.upsert({
        where: {
          tripId_userId: {
            tripId: invite.tripId,
            userId: user.id,
          },
        },
        create: {
          tripId: invite.tripId,
          userId: user.id,
        },
        update: {},
      });
    }

    // Mark invite as accepted
    await prisma.deviceInvite.update({
      where: { id: invite.id },
      data: { accepted: true, acceptedAt: new Date() },
    });

    // Log audit trail
    if (invite.tripId) {
      await logAuditTrailEntry(invite.tripId, user.id, 'user_joined', {
        email: accountEmail,
        name: displayName,
      });
    }

    const response = NextResponse.json({ user, success: true });
    response.cookies.set('deviceId', deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json(
      { error: 'Failed to accept invite' },
      { status: 500 }
    );
  }
}
