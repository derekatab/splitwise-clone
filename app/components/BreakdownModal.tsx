'use client';

import React, { useState } from 'react';

interface ExpenseDetail {
  expenseId: string;
  description?: string;
  paidByToForFrom: number;
  paidByFromForTo: number;
}

interface BreakdownModalProps {
  fromName: string;
  toName: string;
  amount: number;
  paidByTo: number;
  paidByFrom: number;
  expenses: ExpenseDetail[];
}

export default function BreakdownModal({
  fromName,
  toName,
  amount,
  paidByTo,
  paidByFrom,
  expenses,
}: BreakdownModalProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'from' | 'to'>('all');

  // paidByToForFrom: amount that "to" (creditor) paid for "from" (debtor)
  // paidByFromForTo: amount that "from" (debtor) paid for "to" (creditor)
  const filteredExpenses = expenses.filter((exp) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'to') return exp.paidByToForFrom > 0;
    if (selectedFilter === 'from') return exp.paidByFromForTo > 0;
    return true;
  });

  const expensesByPayer = {
    from: expenses.filter((e) => e.paidByFromForTo > 0),
    to: expenses.filter((e) => e.paidByToForFrom > 0),
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-slate-400 mb-1">{toName} paid</p>
            <p className="text-indigo-300 font-semibold text-sm">${paidByTo.toFixed(2)}</p>
            <p className="text-slate-500 text-xs mt-1">for {fromName}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-1">{fromName} paid</p>
            <p className="text-indigo-300 font-semibold text-sm">${paidByFrom.toFixed(2)}</p>
            <p className="text-slate-500 text-xs mt-1">for {toName}</p>
          </div>
        </div>
      </div>

      <div className="bg-indigo-600/20 rounded-lg p-3 border border-indigo-500/50">
        <p className="text-xs text-slate-400 mb-1">Net Amount</p>
        <p className="text-lg font-bold text-indigo-400">
          {fromName} owes {toName} ${amount.toFixed(2)}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Calculated as: ${paidByTo.toFixed(2)} - ${paidByFrom.toFixed(2)} = ${amount.toFixed(2)}
        </p>
      </div>

      {expenses.length > 0 && (
        <div>
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-300 mb-2">Filter expenses:</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  selectedFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                }`}
              >
                All
              </button>
              {expensesByPayer.to.length > 0 && (
                <button
                  onClick={() => setSelectedFilter('to')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    selectedFilter === 'to'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                  }`}
                >
                  {toName}
                </button>
              )}
              {expensesByPayer.from.length > 0 && (
                <button
                  onClick={() => setSelectedFilter('from')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    selectedFilter === 'from'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                  }`}
                >
                  {fromName}
                </button>
              )}
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-300 mb-2">
            Expenses included: ({filteredExpenses.length})
          </p>
          <div className="space-y-2">
            {filteredExpenses.map((exp, idx) => (
              <div key={idx} className="bg-slate-700/20 rounded p-2 text-xs border border-slate-600/30">
                <p className="text-slate-300 font-medium">
                  {exp.description || 'Unnamed expense'}
                </p>
                {exp.paidByToForFrom > 0 && (
                  <p className="text-slate-400 mt-1">
                    <span className="font-medium text-indigo-300">{toName}</span> paid $
                    {exp.paidByToForFrom.toFixed(2)} for <span className="font-medium text-indigo-300">{fromName}</span>
                  </p>
                )}
                {exp.paidByFromForTo > 0 && (
                  <p className="text-slate-400 mt-1">
                    <span className="font-medium text-indigo-300">{fromName}</span> paid $
                    {exp.paidByFromForTo.toFixed(2)} for <span className="font-medium text-indigo-300">{toName}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
