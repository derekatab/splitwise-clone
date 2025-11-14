import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const tripId = request.nextUrl.searchParams.get('tripId');
    const deviceId = request.cookies.get('deviceId')?.value;

    if (!deviceId || !tripId) {
      return NextResponse.json(
        { error: 'Unauthorized or missing tripId' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({ where: { deviceId } });
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is member of trip
    const member = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const expenses = await prisma.expense.findMany({
      where: { tripId },
      include: {
        creator: true,
        splits: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    return NextResponse.json(
      { error: 'Failed to get expenses' },
      { status: 500 }
    );
  }
}
