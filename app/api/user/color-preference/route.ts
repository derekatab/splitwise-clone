import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userColorPalette } from '@/lib/utils/userColors';

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

    const { colorPreference } = await request.json();

    // Validate color preference
    if (!colorPreference || !userColorPalette.find((c) => c.id === colorPreference)) {
      return NextResponse.json(
        { error: 'Invalid color preference' },
        { status: 400 }
      );
    }

    // Update user color preference
    const updatedUser = await prisma.user.update({
      where: { id: device.user.id },
      data: { colorPreference },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Color preference update error:', error);
    return NextResponse.json(
      { error: 'Failed to update color preference' },
      { status: 500 }
    );
  }
}
