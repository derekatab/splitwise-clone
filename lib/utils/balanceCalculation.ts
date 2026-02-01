export interface BalanceCalculationInput {
  expenses: Array<{
    id: string;
    amountCAD: number;
    createdBy: string;
    splits: Array<{
      userId: string;
      amountCAD: number;
    }>;
  }>;
  members: string[]; // User IDs
}

export interface DetailedDebt {
  from: string;
  to: string;
  amount: number;
  breakdown: {
    paidByTo: number;
    paidByFrom: number;
    netAmount: number;
    expenses: Array<{
      expenseId: string;
      description?: string;
      paidByToForFrom: number;
      paidByFromForTo: number;
    }>;
  };
}

export function calculateBalances(input: BalanceCalculationInput): {
  [userId: string]: number;
} {
  const balances: { [userId: string]: number } = {};

  // Initialize balances for all members
  input.members.forEach((userId) => {
    balances[userId] = 0;
  });

  // Process each expense
  input.expenses.forEach((expense) => {
    const paidBy = expense.createdBy;
    const totalAmount = expense.amountCAD;

    // Add amount to payer (they paid it, so they're owed)
    balances[paidBy] = (balances[paidBy] || 0) + totalAmount;

    // Subtract amounts from those who owe (including the payer's own share)
    expense.splits.forEach((split) => {
      balances[split.userId] = (balances[split.userId] || 0) - split.amountCAD;
    });
  });

  return balances;
}

export function calculateDetailedDebts(input: BalanceCalculationInput): DetailedDebt[] {
  // Track pairwise payments between each pair of users
  const pairwisePayments: {
    [key: string]: {
      paidByA: number;
      paidByB: number;
      expensesA: Array<{ expenseId: string; amount: number }>;
      expensesB: Array<{ expenseId: string; amount: number }>;
    };
  } = {};

  // Process each expense
  input.expenses.forEach((expense) => {
    const paidBy = expense.createdBy;

    // For each person in the split (who owes)
    expense.splits.forEach((split) => {
      const owes = split.userId;
      const amount = split.amountCAD;

      if (owes !== paidBy) {
        // Create a consistent key for this pair (sorted to avoid duplicates)
        const pair = [paidBy, owes].sort();
        const key = pair.join('|');

        if (!pairwisePayments[key]) {
          pairwisePayments[key] = {
            paidByA: 0,
            paidByB: 0,
            expensesA: [],
            expensesB: [],
          };
        }

        // Track who paid for whom
        if (pair[0] === paidBy) {
          // A (paidBy) paid for B (owes)
          pairwisePayments[key].paidByA += amount;
          pairwisePayments[key].expensesA.push({ expenseId: expense.id, amount });
        } else {
          // B (paidBy) paid for A (owes)
          pairwisePayments[key].paidByB += amount;
          pairwisePayments[key].expensesB.push({ expenseId: expense.id, amount });
        }
      }
    });
  });

  // Convert to detailed debts
  const detailedDebts: DetailedDebt[] = [];

  Object.entries(pairwisePayments).forEach(([key, payment]) => {
    const [userA, userB] = key.split('|');
    const netAmount = payment.paidByA - payment.paidByB;

    // Create combined expense list with proper attribution
    // Only include expenses that directly involve both A and B
    const expenses: Array<{
      expenseId: string;
      description?: string;
      paidByToForFrom: number;
      paidByFromForTo: number;
    }> = [];

    // Add expenses where A paid for B
    payment.expensesA.forEach((exp) => {
      expenses.push({
        expenseId: exp.expenseId,
        paidByToForFrom: exp.amount,
        paidByFromForTo: 0,
      });
    });

    // Add expenses where B paid for A
    payment.expensesB.forEach((exp) => {
      expenses.push({
        expenseId: exp.expenseId,
        paidByToForFrom: 0,
        paidByFromForTo: exp.amount,
      });
    });

    // Filter to only include expenses that involve BOTH users
    // (expenses where at least one has a non-zero value)
    const relevantExpenses = expenses.filter(
      (exp) => exp.paidByToForFrom > 0 || exp.paidByFromForTo > 0
    );

    if (netAmount !== 0) {
      if (netAmount > 0) {
        // netAmount > 0 means: paidByA > paidByB
        // This means A paid more for B than B paid for A
        // Therefore: B owes A
        // We need to map expenses so that:
        // - paidByTo refers to what A (the creditor) paid for B (the debtor)
        // - paidByFrom refers to what B (the debtor) paid for A (the creditor)
        const mappedExpenses = relevantExpenses.map((exp) => ({
          ...exp,
          paidByToForFrom: exp.paidByToForFrom,      // A paid for B - creditor paid for debtor ✓
          paidByFromForTo: exp.paidByFromForTo,      // B paid for A - debtor paid for creditor ✓
        }));

        detailedDebts.push({
          from: userB,
          to: userA,
          amount: Math.abs(netAmount),
          breakdown: {
            paidByTo: payment.paidByA,
            paidByFrom: payment.paidByB,
            netAmount: Math.abs(netAmount),
            expenses: mappedExpenses,
          },
        });
      } else {
        // netAmount < 0 means: paidByA < paidByB
        // This means B paid more for A than A paid for B
        // Therefore: A owes B
        // We need to map expenses so that:
        // - paidByTo refers to what B (the creditor) paid for A (the debtor)
        // - paidByFrom refers to what A (the debtor) paid for B (the creditor)
        // In the alphabetically-sorted pair:
        // - paidByToForFrom = A paid for B (but now A is debtor, B is creditor, so this is debtor paying creditor - wrong place)
        // - paidByFromForTo = B paid for A (but now B is creditor, A is debtor, so this is creditor paying debtor - wrong place)
        // We need to SWAP these values
        const mappedExpenses = relevantExpenses.map((exp) => ({
          ...exp,
          paidByToForFrom: exp.paidByFromForTo,      // Swap: B paid for A - creditor paid for debtor ✓
          paidByFromForTo: exp.paidByToForFrom,      // Swap: A paid for B - debtor paid for creditor ✓
        }));

        detailedDebts.push({
          from: userA,
          to: userB,
          amount: Math.abs(netAmount),
          breakdown: {
            paidByTo: payment.paidByB,
            paidByFrom: payment.paidByA,
            netAmount: Math.abs(netAmount),
            expenses: mappedExpenses,
          },
        });
      }
    }
  });

  return detailedDebts;
}

/**
 * Calculates optimized debts using net balance matching instead of pairwise netting.
 * This produces the minimum number of transactions needed to settle all debts.
 *
 * Instead of showing "A owes B, B owes C, C owes A" (3 transactions),
 * it matches creditors with debtors to minimize transactions.
 */
export function calculateOptimizedDetailedDebts(input: BalanceCalculationInput): DetailedDebt[] {
  // First, calculate net balances
  const balances = calculateBalances(input);

  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];

  Object.entries(balances).forEach(([userId, balance]) => {
    if (balance > 0) {
      creditors.push({ userId, amount: balance });
    } else if (balance < 0) {
      debtors.push({ userId, amount: Math.abs(balance) });
    }
  });

  // Get pairwise payments to build breakdown details
  const pairwisePayments: {
    [key: string]: {
      paidByA: number;
      paidByB: number;
      expensesA: Array<{ expenseId: string; amount: number }>;
      expensesB: Array<{ expenseId: string; amount: number }>;
    };
  } = {};

  input.expenses.forEach((expense) => {
    const paidBy = expense.createdBy;

    expense.splits.forEach((split) => {
      const owes = split.userId;
      const amount = split.amountCAD;

      if (owes !== paidBy) {
        const pair = [paidBy, owes].sort();
        const key = pair.join('|');

        if (!pairwisePayments[key]) {
          pairwisePayments[key] = {
            paidByA: 0,
            paidByB: 0,
            expensesA: [],
            expensesB: [],
          };
        }

        if (pair[0] === paidBy) {
          pairwisePayments[key].paidByA += amount;
          pairwisePayments[key].expensesA.push({ expenseId: expense.id, amount });
        } else {
          pairwisePayments[key].paidByB += amount;
          pairwisePayments[key].expensesB.push({ expenseId: expense.id, amount });
        }
      }
    });
  });

  // Match creditors with debtors
  const detailedDebts: DetailedDebt[] = [];
  let creditorIdx = 0;
  let debtorIdx = 0;

  while (creditorIdx < creditors.length && debtorIdx < debtors.length) {
    const creditor = creditors[creditorIdx];
    const debtor = debtors[debtorIdx];

    // Amount that the debtor will pay to the creditor
    const settlementAmount = Math.min(creditor.amount, debtor.amount);

    // Get breakdown by looking at pairwise payments
    const pair = [debtor.userId, creditor.userId].sort();
    const key = pair.join('|');
    const pairPayment = pairwisePayments[key];

    let expenses: Array<{
      expenseId: string;
      description?: string;
      paidByToForFrom: number;
      paidByFromForTo: number;
    }> = [];

    if (pairPayment) {
      // Build expenses list for this pair
      pairPayment.expensesA.forEach((exp) => {
        expenses.push({
          expenseId: exp.expenseId,
          paidByToForFrom: exp.amount,
          paidByFromForTo: 0,
        });
      });

      pairPayment.expensesB.forEach((exp) => {
        expenses.push({
          expenseId: exp.expenseId,
          paidByToForFrom: 0,
          paidByFromForTo: exp.amount,
        });
      });
    }

    // Determine who is "to" (creditor) and who is "from" (debtor)
    let paidByTo = 0;
    let paidByFrom = 0;

    if (pairPayment) {
      if (pair[0] === creditor.userId) {
        paidByTo = pairPayment.paidByA;
        paidByFrom = pairPayment.paidByB;
      } else {
        paidByTo = pairPayment.paidByB;
        paidByFrom = pairPayment.paidByA;
      }
    }

    detailedDebts.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: settlementAmount,
      breakdown: {
        paidByTo,
        paidByFrom,
        netAmount: settlementAmount,
        expenses,
      },
    });

    // Update balances
    creditor.amount -= settlementAmount;
    debtor.amount -= settlementAmount;

    // Move to next creditor or debtor
    if (creditor.amount === 0) creditorIdx++;
    if (debtor.amount === 0) debtorIdx++;
  }

  return detailedDebts;
}

export function getBalanceSummaryForUser(
  balances: { [userId: string]: number },
  userId: string,
  userIdToNameMap: { [id: string]: string }
): {
  owedToUser: { userId: string; name: string; amount: number }[];
  userOwes: { userId: string; name: string; amount: number }[];
} {
  const owedToUser: { userId: string; name: string; amount: number }[] = [];
  const userOwes: { userId: string; name: string; amount: number }[] = [];

  Object.entries(balances).forEach(([otherId, balance]) => {
    if (otherId === userId) return;

    const amount = Math.abs(balance);
    const name = userIdToNameMap[otherId] || 'Unknown';

    if (balance > 0) {
      // Other person owes money overall
      // If current user paid for their share, they're owed
      owedToUser.push({ userId: otherId, name, amount });
    } else if (balance < 0) {
      // Other person is owed money overall
      userOwes.push({ userId: otherId, name, amount });
    }
  });

  return { owedToUser, userOwes };
}
