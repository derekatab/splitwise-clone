import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { convertToCAD, refreshExchangeRates } from '@/lib/utils/currencyConversion';
import { logAuditTrailEntry } from '@/lib/utils/auditTrail';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const {
      tripId,
      description,
      originalAmount,
      originalCurrency,
      splits,
    } = await request.json();

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

    // Refresh exchange rates if this is a new currency OR rates are stale
    if (originalCurrency !== 'CAD') {
      const existingRate = await prisma.exchangeRateCache.findUnique({
        where: { currency: originalCurrency },
      });

      const isStale = existingRate &&
        (Date.now() - new Date(existingRate.updatedAt).getTime()) > 24 * 60 * 60 * 1000;

      if (!existingRate || isStale) {
        try {
          await refreshExchangeRates();
        } catch (error) {
          console.error('Failed to refresh rates, continuing with conversion:', error);
        }
      }
    }

    // Convert to CAD
    const { amountCAD, exchangeRate } = await convertToCAD(
      originalAmount,
      originalCurrency
    );

    // Create expense
    const expense = await prisma.expense.create({
      data: {
        tripId,
        createdBy: user.id,
        description,
        originalAmount,
        originalCurrency,
        amountCAD,
        exchangeRate,
      },
    });

    // Create splits
    const createdSplits = await Promise.all(
      splits.map((split: any) =>
        prisma.expenseSplit.create({
          data: {
            expenseId: expense.id,
            userId: split.userId,
            amountCAD: split.amountCAD,
            splitType: split.splitType,
            ratio: split.ratio || null,
          },
        })
      )
    );

    // Log audit trail
    await logAuditTrailEntry(tripId, user.id, 'expense_added', {
      expenseId: expense.id,
      description,
      originalAmount,
      originalCurrency,
      amountCAD,
      exchangeRate,
      splits: createdSplits.map((s) => ({
        userId: s.userId,
        amountCAD: s.amountCAD,
        splitType: s.splitType,
      })),
    } as Prisma.JsonObject);

    return NextResponse.json(
      { expense, splits: createdSplits, success: true },
      { status: 201 }
    );
  } catch (error) {
    console.error('Add expense error:', error);
    return NextResponse.json(
      { error: 'Failed to add expense' },
      { status: 500 }
    );
  }
}
