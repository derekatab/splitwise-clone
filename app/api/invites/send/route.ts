import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInviteEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { tripId, email } = await request.json();
    const deviceId = request.cookies.get('deviceId')?.value;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const device = await prisma.device.findUnique({
      where: { deviceId },
      include: { user: true },
    });

    if (!device || !device.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = device.user;

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/join?token=${inviteToken}`;

    // Store invite
    await prisma.deviceInvite.create({
      data: {
        tripId,
        inviteUrl,
        email,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    // Send email
    await sendInviteEmail(email, inviteUrl, trip.name);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send invite error:', error);
    return NextResponse.json(
      { error: 'Failed to send invite' },
      { status: 500 }
    );
  }
}
