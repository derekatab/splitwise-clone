import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateBalances } from '@/lib/utils/balanceCalculation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
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

    // Get trip with all data
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        members: { include: { user: true } },
        expenses: {
          include: {
            creator: true,
            splits: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Calculate balances
    const expenses = trip.expenses.map((exp) => ({
      id: exp.id,
      amountCAD: exp.amountCAD,
      createdBy: exp.createdBy,
      splits: exp.splits.map((s) => ({ userId: s.userId, amountCAD: s.amountCAD })),
    }));

    const memberIds = trip.members.map((m) => m.userId);
    const balances = calculateBalances({ expenses, members: memberIds });

    return NextResponse.json({ trip, balances });
  } catch (error) {
    console.error('Get trip error:', error);
    return NextResponse.json(
      { error: 'Failed to get trip' },
      { status: 500 }
    );
  }
}
