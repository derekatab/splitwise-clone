import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface AuditAction {
  action: string;
  details: Record<string, any>;
}

export async function logAuditTrailEntry(
  tripId: string,
  userId: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  await prisma.auditTrailEntry.create({
    data: {
      tripId,
      userId,
      action,
      details: details as Prisma.JsonObject,
    },
  });
}

export async function getAuditTrail(
  tripId: string,
  limit: number = 50,
  offset: number = 0
) {
  return prisma.auditTrailEntry.findMany({
    where: { tripId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function formatAuditTrailForDisplay(
  tripId: string,
  userMap: { [id: string]: { name: string; email: string } }
) {
  const entries = await getAuditTrail(tripId);

  return entries.map((entry) => {
    const user = entry.user || { name: 'Unknown', email: 'unknown@example.com' };
    let actionText = '';

    switch (entry.action) {
      case 'trip_created':
        actionText = `${user.name} created the trip`;
        break;
      case 'user_joined':
        actionText = `${user.name} joined the trip`;
        break;
      case 'expense_added':
        const expenseDetails = entry.details as any;
        actionText = `${user.name} added an expense: $${expenseDetails.amountCAD} CAD (${expenseDetails.originalAmount} ${expenseDetails.originalCurrency})`;
        break;
      case 'expense_updated':
        actionText = `${user.name} updated an expense`;
        break;
      case 'expense_deleted':
        actionText = `${user.name} deleted an expense`;
        break;
      default:
        actionText = `${user.name} performed action: ${entry.action}`;
    }

    return {
      id: entry.id,
      action: entry.action,
      actionText,
      user,
      timestamp: entry.createdAt,
      details: entry.details,
    };
  });
}
