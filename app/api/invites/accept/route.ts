import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDeviceId } from '@/lib/utils/deviceTracking';
import { logAuditTrailEntry } from '@/lib/utils/auditTrail';

export async function POST(request: NextRequest) {
  try {
    const { token, name, email } = await request.json();
    const deviceId = request.cookies.get('deviceId')?.value || generateDeviceId();

    // Find invite
    const invite = await prisma.deviceInvite.findUnique({
      where: {
        inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/join?token=${token}`,
      },
    });

    if (!invite || invite.accepted) {
      return NextResponse.json(
        { error: 'Invalid or already used invite' },
        { status: 404 }
      );
    }

    // Create or get user
    let user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: { email, name },
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

    // Add user to trip
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

    // Mark invite as accepted
    await prisma.deviceInvite.update({
      where: { id: invite.id },
      data: { accepted: true, acceptedAt: new Date() },
    });

    // Log audit trail
    await logAuditTrailEntry(invite.tripId, user.id, 'user_joined', {
      email,
      name,
    });

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
