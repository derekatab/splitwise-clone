'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface TripMember {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

type SplitType = 'equal' | 'ratio' | 'amount';

interface Split {
  userId: string;
  splitType: SplitType;
  ratio?: number;
  amount?: number;
}

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CNY', 'INR', 'MXN'];

export default function AddExpense() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const [members, setMembers] = useState<TripMember[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConversionConfirm, setShowConversionConfirm] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  useEffect(() => {
    const fetchTrip = async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}`);
        if (!res.ok) throw new Error('Failed to fetch trip');
        const data = await res.json();
        setMembers(data.trip.members);

        // Initialize splits for equal distribution
        const initialSplits: Split[] = data.trip.members.map((member: TripMember) => ({
          userId: member.user.id,
          splitType: 'equal',
        }));
        setSplits(initialSplits);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trip');
      } finally {
        setLoading(false);
      }
    };

    if (tripId) fetchTrip();
  }, [tripId]);

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
  };

  useEffect(() => {
    const checkConversion = async () => {
      if (currency !== 'CAD' && amount) {
        try {
          const numAmount = parseFloat(amount);
          if (isNaN(numAmount) || numAmount <= 0) return;

          const res = await fetch(
            `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/${currency}`
          );

          if (!res.ok) throw new Error('Failed to fetch exchange rate');

          const data = await res.json();
          const cadRate = data.conversion_rates.CAD;
          const converted = numAmount * cadRate;

          setExchangeRate(cadRate);
          setConvertedAmount(converted);
          setShowConversionConfirm(true);
        } catch (err) {
          console.error('Exchange rate error:', err);
          setError('Failed to fetch exchange rate');
        }
      } else {
        setShowConversionConfirm(false);
        setExchangeRate(null);
        setConvertedAmount(null);
      }
    };

    checkConversion();
  }, [currency, amount]);

  const handleSplitTypeChange = (newType: SplitType) => {
    setSplitType(newType);
    setSplits(
      splits.map((split) => ({
        ...split,
        splitType: newType,
        ratio: undefined,
        amount: undefined,
      }))
    );
  };

  const updateSplitRatio = (userId: string, ratio: number) => {
    setSplits(
      splits.map((split) =>
        split.userId === userId ? { ...split, ratio } : split
      )
    );
  };

  const updateSplitAmount = (userId: string, amount: number) => {
    setSplits(
      splits.map((split) =>
        split.userId === userId ? { ...split, amount } : split
      )
    );
  };

  const getTotalAllocated = () => {
    if (splitType === 'amount') {
      return splits.reduce((sum, s) => sum + (s.amount || 0), 0);
    }
    return 0;
  };

  const getUnallocated = () => {
    const numAmount = parseFloat(amount) || 0;
    return Math.max(0, numAmount - getTotalAllocated());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!description || !amount || !currency) {
        throw new Error('Please fill in all required fields');
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (splitType === 'amount' && Math.abs(getTotalAllocated() - numAmount) > 0.01) {
        throw new Error('Split amounts must equal the total expense');
      }

      // Prepare splits based on split type
      let finalSplits: any[] = [];

      if (splitType === 'equal') {
        const perPerson = numAmount / members.length;
        finalSplits = members.map((member) => ({
          userId: member.user.id,
          amountCAD: parseFloat(
            (currency === 'CAD' ? perPerson : perPerson * (exchangeRate || 1)).toFixed(2)
          ),
          splitType: 'equal',
        }));
      } else if (splitType === 'ratio') {
        const totalRatio = splits.reduce((sum, s) => sum + (s.ratio || 0), 0);
        if (totalRatio === 0) throw new Error('Please set ratios for all members');

        finalSplits = splits.map((split) => {
          const ratio = split.ratio || 0;
          const splitAmount = (numAmount * ratio) / totalRatio;
          return {
            userId: split.userId,
            amountCAD: parseFloat(
              (currency === 'CAD' ? splitAmount : splitAmount * (exchangeRate || 1)).toFixed(2)
            ),
            splitType: 'ratio',
            ratio,
          };
        });
      } else if (splitType === 'amount') {
        finalSplits = splits
          .filter((split) => typeof split.amount === 'number' && split.amount > 0)
          .map((split) => {
            const originalAmt = split.amount ?? 0;
            const rate = exchangeRate ?? 1;
            const amountInCAD = currency === 'CAD' ? originalAmt : originalAmt * rate;
            return {
              userId: split.userId,
              amountCAD: parseFloat(amountInCAD.toFixed(2)),
              splitType: 'amount',
            };
          });
      }

      const res = await fetch('/api/expenses/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          description,
          originalAmount: numAmount,
          originalCurrency: currency,
          splits: finalSplits,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add expense');
      }

      router.push(`/trips/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-white">Add Expense</h1>
            <Link
              href={`/trips/${tripId}`}
              className="text-slate-400 hover:text-white transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Expense Details */}
          <div className="bg-slate-800 rounded-2xl shadow-lg p-8 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6">Expense Details</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Description <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Dinner at restaurant, Gas for car"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Amount <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Currency <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  >
                    {CURRENCIES.map((curr) => (
                      <option key={curr} value={curr}>
                        {curr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Currency Conversion Notice */}
              {showConversionConfirm && currency !== 'CAD' && exchangeRate && convertedAmount && (
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
                  <p className="text-blue-300 font-semibold mb-2">Currency Conversion</p>
                  <p className="text-blue-200 text-sm">
                    {amount} {currency} = ${convertedAmount.toFixed(2)} CAD
                  </p>
                  <p className="text-blue-200 text-xs mt-2 opacity-75">
                    Exchange Rate: 1 {currency} = ${exchangeRate.toFixed(6)} CAD
                  </p>
                  <p className="text-blue-200 text-xs mt-3">
                    ✓ All amounts will be displayed in CAD
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Split Type Selection */}
          <div className="bg-slate-800 rounded-2xl shadow-lg p-8 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6">How to Split</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['equal', 'ratio', 'amount'] as SplitType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSplitTypeChange(type)}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    splitType === type
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  <p className="font-semibold text-white capitalize">{type}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {type === 'equal' && 'Split equally among all members'}
                    {type === 'ratio' && 'Split by custom ratios'}
                    {type === 'amount' && 'Split by specific amounts'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Split Details */}
          <div className="bg-slate-800 rounded-2xl shadow-lg p-8 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6">Split Details</h2>

            <div className="space-y-4">
              {members.map((member) => {
                const split = splits.find((s) => s.userId === member.user.id);
                const numAmount = parseFloat(amount) || 0;

                return (
                  <div
                    key={member.user.id}
                    className="flex items-center justify-between bg-slate-700/50 p-4 rounded-lg border border-slate-600"
                  >
                    <div className="flex-1">
                      <p className="text-white font-semibold">{member.user.name}</p>
                      <p className="text-xs text-slate-400">{member.user.email}</p>
                    </div>

                    {splitType === 'equal' && (
                      <div className="text-right">
                        <p className="text-indigo-400 font-semibold">
                          ${(numAmount / members.length).toFixed(2)}
                        </p>
                      </div>
                    )}

                    {splitType === 'ratio' && (
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={split?.ratio || 0}
                        onChange={(e) => updateSplitRatio(member.user.id, parseFloat(e.target.value) || 0)}
                        placeholder="Ratio"
                        className="w-24 px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 text-right text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    )}

                    {splitType === 'amount' && (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={numAmount}
                        value={split?.amount || 0}
                        onChange={(e) => updateSplitAmount(member.user.id, parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-28 px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 text-right text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Unallocated Amount for Manual Split */}
            {splitType === 'amount' && amount && (
              <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex justify-between items-center">
                  <p className="text-slate-300 font-semibold">Unallocated:</p>
                  <p
                    className={`text-lg font-bold ${
                      getUnallocated() > 0 ? 'text-yellow-400' : 'text-green-400'
                    }`}
                  >
                    ${getUnallocated().toFixed(2)}
                  </p>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {getUnallocated() > 0
                    ? 'Allocate the remaining amount above'
                    : '✓ All amount allocated'}
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting || !description || !amount || !currency}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold shadow-lg hover:shadow-indigo-500/50"
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Adding...
                </div>
              ) : (
                'Add Expense'
              )}
            </button>
            <Link
              href={`/trips/${tripId}`}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg transition font-semibold text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}