import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditTrailEntry } from '@/lib/utils/auditTrail';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  try {
    const { expenseId } = await params;
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

    // Get the expense
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { trip: true },
    });

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    // Check if user is member of trip and is the one who created the expense
    const member = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: expense.tripId,
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

    // Only allow the creator to delete the expense
    if (expense.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Only the expense creator can delete it' },
        { status: 403 }
      );
    }

    // Delete the expense (splits will be cascade deleted)
    const deletedExpense = await prisma.expense.delete({
      where: { id: expenseId },
    });

    // Log audit trail
    await logAuditTrailEntry(expense.tripId, user.id, 'expense_deleted', {
      description: deletedExpense.description,
      originalAmount: deletedExpense.originalAmount,
      originalCurrency: deletedExpense.originalCurrency,
      amountCAD: deletedExpense.amountCAD,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete expense error:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    );
  }
}
