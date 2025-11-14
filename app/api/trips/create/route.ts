import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditTrailEntry } from '@/lib/utils/auditTrail';

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();
    const deviceId = request.cookies.get('deviceId')?.value;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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

    // Create trip
    const trip = await prisma.trip.create({
      data: {
        name,
        description,
        createdBy: user.id,
      },
    });

    // Add creator as member
    await prisma.tripMember.create({
      data: {
        tripId: trip.id,
        userId: user.id,
      },
    });

    // Log audit trail
    await logAuditTrailEntry(trip.id, user.id, 'trip_created', {
      name,
      description,
    });

    return NextResponse.json({ trip, success: true }, { status: 201 });
  } catch (error) {
    console.error('Create trip error:', error);
    return NextResponse.json(
      { error: 'Failed to create trip' },
      { status: 500 }
    );
  }
}
