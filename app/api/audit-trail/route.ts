import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const tripId = request.nextUrl.searchParams.get('tripId');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');
    const deviceId = request.cookies.get('deviceId')?.value;

    if (!deviceId || !tripId) {
      return NextResponse.json(
        { error: 'Unauthorized or missing tripId' },
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

    const auditTrail = await prisma.auditTrailEntry.findMany({
      where: { tripId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.auditTrailEntry.count({
      where: { tripId },
    });

    return NextResponse.json({ auditTrail, total });
  } catch (error) {
    console.error('Get audit trail error:', error);
    return NextResponse.json(
      { error: 'Failed to get audit trail' },
      { status: 500 }
    );
  }
}
