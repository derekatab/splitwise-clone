import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDeviceId } from '@/lib/utils/deviceTracking';

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    const deviceId = request.cookies.get('deviceId')?.value || generateDeviceId();

    // Create or get user
    let user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: { email, name },
    });

    // Create device if it doesn't exist
    await prisma.device.upsert({
      where: { deviceId },
      update: { lastUsedAt: new Date() },
      create: {
        deviceId,
        userId: user.id,
      },
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
    console.error('Register device error:', error);
    return NextResponse.json(
      { error: 'Failed to register device' },
      { status: 500 }
    );
  }
}
