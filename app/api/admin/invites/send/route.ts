import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInviteEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Admin authentication - check secret key
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET_KEY;

    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid admin key' },
        { status: 401 }
      );
    }

    const { tripId, email } = await request.json();

    if (!tripId || !email) {
      return NextResponse.json(
        { error: 'tripId and email are required' },
        { status: 400 }
      );
    }

    // Verify trip exists
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/join?token=${inviteToken}`;

    // Store invite in database
    const invite = await prisma.deviceInvite.create({
      data: {
        tripId,
        inviteUrl,
        email,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });

    // Send email via Gmail
    await sendInviteEmail(email, inviteUrl, trip.name);

    return NextResponse.json({
      success: true,
      message: `Invite sent to ${email}`,
      inviteId: invite.id,
    });
  } catch (error) {
    console.error('Send admin invite error:', error);
    return NextResponse.json(
      { error: 'Failed to send invite', details: error instanceof Error ? error.message : '' },
      { status: 500 }
    );
  }
}
