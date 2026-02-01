import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient({
  accelerateUrl: process.env.PRISMA_DATABASE_URL,
});

async function deleteExpense() {
  try {
    const expenseId = 'cml4b5sqa000ifl58orsevg3s';
    const auditTrailId = 'cml4b5tbs000nfl58kde8l5r7';

    console.log('Deleting audit trail entry...');
    const deletedAudit = await prisma.auditTrailEntry.delete({
      where: { id: auditTrailId },
    });
    console.log('✅ Audit trail deleted:', deletedAudit.id);

    console.log('\nDeleting expense splits...');
    const deletedSplits = await prisma.expenseSplit.deleteMany({
      where: { expenseId },
    });
    console.log(`✅ Deleted ${deletedSplits.count} expense splits`);

    console.log('\nDeleting expense...');
    const deletedExpense = await prisma.expense.delete({
      where: { id: expenseId },
    });
    console.log('✅ Expense deleted:', deletedExpense.id);

    console.log('\n✅ Expense and audit trail removed successfully!');

  } catch (error) {
    console.error('Error deleting expense:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteExpense();
