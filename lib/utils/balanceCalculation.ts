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

    // Subtract amounts from those who owe
    expense.splits.forEach((split) => {
      if (split.userId !== paidBy) {
        balances[split.userId] = (balances[split.userId] || 0) - split.amountCAD;
      }
    });
  });

  return balances;
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
