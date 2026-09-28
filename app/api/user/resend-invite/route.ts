import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInviteEmail } from '@/lib/email';
import { buildInviteUrl } from '@/lib/invites';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
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

    if (!user.email) {
      return NextResponse.json(
        { error: 'Your account has no email address yet, so an invite cannot be sent' },
        { status: 400 }
      );
    }

    // Generate invite token (same as admin invites)
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteUrl = buildInviteUrl(inviteToken);

    // Create a DeviceInvite for this user's device setup
    // Use a dummy trip (can be created just for device setup purposes)
    await prisma.deviceInvite.create({
      data: {
        tripId: '', // Empty tripId since this is for device setup, not trip-specific
        inviteUrl,
        email: user.email,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    // Send invite email
    await sendInviteEmail(user.email, inviteUrl, 'Splitwise');

    return NextResponse.json({
      success: true,
      message: 'Invitation email sent',
    });
  } catch (error) {
    console.error('Resend invite error:', error);
    return NextResponse.json(
      { error: 'Failed to resend invitation' },
      { status: 500 }
    );
  }
}
