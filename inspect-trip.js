const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectTrip() {
  const tripId = 'cmkte74oj0000cx3zbq33mqei';

  // Get trip with all expenses and splits
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      expenses: {
        include: { splits: true }
      },
      members: {
        include: { user: true }
      }
    }
  });

  console.log('\n=== TRIP INFO ===');
  console.log('Trip: ' + trip.name);
  console.log('Members: ' + trip.members.map(m => m.user.name).join(', ') + '\n');

  // Get user IDs
  const userMap = {};
  trip.members.forEach(m => {
    userMap[m.user.id] = m.user.name;
  });

  console.log('=== ALL EXPENSES ===\n');
  let totalExpenses = 0;
  trip.expenses.forEach((exp, idx) => {
    const paidByName = userMap[exp.createdBy];
    console.log('Expense ' + (idx + 1) + ': ' + (exp.description || 'Unnamed'));
    console.log('  Amount: $' + exp.amountCAD);
    console.log('  Paid by: ' + paidByName);
    console.log('  Splits:');
    let splitsTotal = 0;
    exp.splits.forEach(split => {
      console.log('    ' + userMap[split.userId] + ': $' + split.amountCAD);
      splitsTotal += split.amountCAD;
    });
    console.log('  Splits Total: $' + splitsTotal.toFixed(2));
    if (Math.abs(splitsTotal - exp.amountCAD) > 0.01) {
      console.log('  WARNING: Expense $' + exp.amountCAD + ' vs Splits $' + splitsTotal.toFixed(2));
    }
    totalExpenses += exp.amountCAD;
    console.log();
  });

  console.log('Total expenses: $' + totalExpenses.toFixed(2) + '\n');

  // Calculate balances manually
  console.log('=== MANUAL BALANCE CALCULATION ===\n');
  const balances = {};
  trip.members.forEach(m => {
    balances[m.user.id] = 0;
  });

  trip.expenses.forEach(exp => {
    const paidBy = exp.createdBy;
    balances[paidBy] += exp.amountCAD;

    exp.splits.forEach(split => {
      balances[split.userId] -= split.amountCAD;
    });
  });

  let totalCreditors = 0;
  let totalDebtors = 0;
  Object.entries(balances).forEach(([userId, balance]) => {
    const name = userMap[userId];
    const status = balance > 0 ? 'Creditor' : balance < 0 ? 'Debtor' : 'Even';
    console.log(name + ': ' + (balance >= 0 ? '+' : '') + '$' + balance.toFixed(2) + ' (' + status + ')');
    if (balance > 0) totalCreditors += balance;
    if (balance < 0) totalDebtors -= balance;
  });

  console.log('\nTotal Creditors: $' + totalCreditors.toFixed(2));
  console.log('Total Debtors: $' + totalDebtors.toFixed(2));
  console.log('Difference: $' + Math.abs(totalCreditors - totalDebtors).toFixed(2));

  // Calculate pairwise payments
  console.log('\n=== PAIRWISE PAYMENTS (William <-> Big D) ===\n');

  // Find William and Big D
  let williamId, bigDId;
  Object.entries(userMap).forEach(([id, name]) => {
    if (name === 'William') williamId = id;
    if (name === 'Big D') bigDId = id;
  });

  if (williamId && bigDId) {
    let williamPaidForBigD = 0;
    let bigDPaidForWilliam = 0;

    trip.expenses.forEach(exp => {
      const williamSplit = exp.splits.find(s => s.userId === williamId);
      const bigDSplit = exp.splits.find(s => s.userId === bigDId);

      if (exp.createdBy === bigDId && williamSplit) {
        console.log('Big D paid $' + exp.amountCAD + ', William\'s split: $' + williamSplit.amountCAD);
        bigDPaidForWilliam += williamSplit.amountCAD;
      }
      if (exp.createdBy === williamId && bigDSplit) {
        console.log('William paid $' + exp.amountCAD + ', Big D\'s split: $' + bigDSplit.amountCAD);
        williamPaidForBigD += bigDSplit.amountCAD;
      }
    });

    console.log('\nBig D paid for William: $' + bigDPaidForWilliam.toFixed(2));
    console.log('William paid for Big D: $' + williamPaidForBigD.toFixed(2));
    console.log('Net (William owes Big D): $' + (bigDPaidForWilliam - williamPaidForBigD).toFixed(2));

    console.log('\nBig D\'s balance: $' + balances[bigDId].toFixed(2));
    console.log('William\'s balance: $' + balances[williamId].toFixed(2));
  }

  await prisma.$disconnect();
}

inspectTrip().catch(console.error);
