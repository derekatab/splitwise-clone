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

  const isDirectCalculation = (paidByTo > 0 || paidByFrom > 0) && Math.abs((paidByTo - paidByFrom) - amount) < 0.01;

  return (
    <div className="space-y-4">
      {isDirectCalculation && (
        <div className="bg-indigo-600/15 rounded-lg p-3 border border-indigo-500/40">
          <p className="text-xs font-semibold text-indigo-300 mb-2">Calculation Details</p>
          <div className="space-y-2 text-xs">
            <div className="bg-slate-700/30 p-2 rounded border border-slate-600/50">
              <p className="text-slate-400 mb-1">{toName} paid for {fromName}:</p>
              <p className="text-indigo-300 font-semibold">${paidByTo.toFixed(2)}</p>
            </div>
            <div className="bg-slate-700/30 p-2 rounded border border-slate-600/50">
              <p className="text-slate-400 mb-1">{fromName} paid for {toName}:</p>
              <p className="text-indigo-300 font-semibold">${paidByFrom.toFixed(2)}</p>
            </div>
            <div className="bg-slate-700/40 p-2 rounded border border-slate-600">
              <p className="text-slate-300 font-semibold text-xs mb-1">Net Settlement:</p>
              <p className="text-slate-300 text-xs font-mono">
                ${paidByTo.toFixed(2)} − ${paidByFrom.toFixed(2)} = <span className="text-indigo-300 font-semibold">${amount.toFixed(2)}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-emerald-600/15 rounded-lg p-3 border border-emerald-500/40">
        <p className="text-xs font-semibold text-emerald-300 mb-1">✓ Settlement Amount</p>
        <p className="text-lg font-bold text-emerald-300">
          {fromName} owes {toName} ${amount.toFixed(2)}
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
            Transactions included: ({filteredExpenses.length})
          </p>

          <div className="space-y-2">
            {filteredExpenses.map((exp, idx) => {
              const directTransaction = exp.paidByToForFrom > 0 || exp.paidByFromForTo > 0;
              const amountUsedInSettlement = exp.paidByToForFrom + exp.paidByFromForTo;

              return (
                <div key={idx} className={`rounded p-2 text-xs border ${
                  directTransaction
                    ? 'bg-slate-700/20 border-slate-600/30'
                    : 'bg-slate-700/10 border-slate-600/20 opacity-85'
                }`}>
                  <div className="flex justify-between items-start">
                    <p className="text-slate-300 font-medium flex-1">
                      {exp.description || 'Unnamed expense'}
                    </p>
                    {!directTransaction && (
                      <span className="text-xs bg-slate-600/50 text-slate-300 px-2 py-0.5 rounded ml-2 flex-shrink-0">
                        indirect
                      </span>
                    )}
                  </div>

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

                  {!directTransaction && (
                    <p className="text-slate-500 text-xs mt-2 italic">
                      Part of settlement through optimization—no direct payment between {fromName} and {toName}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
