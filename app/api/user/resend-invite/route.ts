import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInviteEmail } from '@/lib/email';

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

    // Create or get an invite for this user
    const invite = await prisma.invite.upsert({
      where: { userId: user.id },
      update: {
        createdAt: new Date(), // Reset the created time to now
      },
      create: {
        userId: user.id,
      },
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}auth/join?inviteId=${invite.id}`;

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
