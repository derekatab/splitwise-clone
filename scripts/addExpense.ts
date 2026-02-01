import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient({
  accelerateUrl: process.env.PRISMA_DATABASE_URL,
});

async function addExpense() {
  try {
    // Trip details
    const tripId = 'cmkte74oj0000cx3zbq33mqei';

    // Find the user with email sheffaine@gmail.com (the expense creator)
    const sheffaine = await prisma.user.findUnique({
      where: { email: 'sheffaine@gmail.com' },
    });

    if (!sheffaine) {
      throw new Error('Sheffaine (sheffaine@gmail.com) not found in the database');
    }

    console.log('Found Sheffaine (expense creator):', sheffaine);

    // Get all trip members
    const tripMembers = await prisma.tripMember.findMany({
      where: { tripId },
      include: { user: true },
    });

    if (tripMembers.length === 0) {
      throw new Error(`No members found for trip ${tripId}`);
    }

    console.log(`Found ${tripMembers.length} trip members:`);
    tripMembers.forEach(m => console.log(`  - ${m.user.name} (${m.user.email})`));

    if (tripMembers.length !== 4) {
      console.warn(`Warning: Expected 4 members, found ${tripMembers.length}`);
    }

    // Expense details
    const originalAmount = 20000;
    const originalCurrency = 'COP';
    const amountCAD = 7.37;
    const exchangeRate = amountCAD / originalAmount;

    // Define split ratios for specific people
    const splitRatios: Record<string, number> = {
      'derekatabayev4@gmail.com': 0.33,  // Big D
      'sheffaine@gmail.com': 0.34,       // Sheffaine
      'willchen361@gmail.com': 0.33,     // William
    };

    console.log('\nExpense details:');
    console.log(`  Description: Club Ubers Sheff`);
    console.log(`  Original Amount: ${originalAmount} ${originalCurrency}`);
    console.log(`  Amount in CAD: ${amountCAD}`);
    console.log(`  Exchange Rate: ${exchangeRate}`);
    console.log(`  Split Type: Ratio`);
    console.log(`  Ratios:`);
    Object.entries(splitRatios).forEach(([email, ratio]) => {
      const amountForRatio = amountCAD * ratio;
      console.log(`    - ${email}: ${ratio} (${amountForRatio.toFixed(2)} CAD)`);
    });

    // Create the expense
    const expense = await prisma.expense.create({
      data: {
        tripId,
        createdBy: sheffaine.id,
        description: 'Club Ubers Sheff',
        originalAmount,
        originalCurrency,
        amountCAD,
        exchangeRate,
      },
    });

    console.log('\nExpense created:', expense.id);

    // Create ratio splits for specified members
    const splits = await Promise.all(
      Object.entries(splitRatios).map(async ([email, ratio]) => {
        const member = tripMembers.find(m => m.user.email === email);
        if (!member) {
          throw new Error(`Member with email ${email} not found in trip`);
        }
        const amountCADForMember = amountCAD * ratio;
        return prisma.expenseSplit.create({
          data: {
            expenseId: expense.id,
            userId: member.userId,
            amountCAD: amountCADForMember,
            splitType: 'ratio',
            ratio: ratio,
          },
        });
      })
    );

    console.log(`\nCreated ${splits.length} expense splits:`);
    splits.forEach((split) => {
      const member = tripMembers.find(m => m.userId === split.userId);
      const ratio = split.ratio;
      console.log(`  - ${member?.user.name} (${member?.user.email}): ${split.amountCAD.toFixed(2)} CAD (ratio: ${ratio})`);
    });

    // Log audit trail entry
    const auditEntry = await prisma.auditTrailEntry.create({
      data: {
        tripId,
        userId: sheffaine.id,
        action: 'expense_added',
        details: {
          expenseId: expense.id,
          description: 'Club Ubers Sheff',
          originalAmount,
          originalCurrency,
          amountCAD,
          exchangeRate,
          splits: splits.map(s => ({
            userId: s.userId,
            amountCAD: s.amountCAD,
            splitType: s.splitType,
          })),
        },
      },
    });

    console.log('\nAudit trail entry created:', auditEntry.id);
    console.log('\n✅ Expense added successfully!');

  } catch (error) {
    console.error('Error adding expense:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addExpense();
