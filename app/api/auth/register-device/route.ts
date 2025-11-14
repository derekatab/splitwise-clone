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

    // Create or update user
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, deviceId },
      create: { email, name, deviceId },
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
