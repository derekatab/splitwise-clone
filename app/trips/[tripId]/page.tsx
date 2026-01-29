'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import InfoPopover from '@/app/components/InfoPopover';
import BreakdownModal from '@/app/components/BreakdownModal';
import { getAvatarClassByColorId } from '@/lib/utils/userColors';

interface User {
  id: string;
  name: string;
  email: string;
  colorPreference?: string;
}

interface ExpenseSplit {
  id: string;
  userId: string;
  amountCAD: number;
  splitType: string;
  ratio: number | null;
}

interface Expense {
  id: string;
  description: string;
  amountCAD: number;
  originalAmount: number;
  originalCurrency: string;
  exchangeRate: number;
  createdAt: string;
  creator: User;
  splits: ExpenseSplit[];
}

interface TripMember {
  user: User;
}

interface Trip {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  members: TripMember[];
  expenses: Expense[];
}

interface Balances {
  [userId: string]: number;
}

interface DetailedDebt {
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

interface AuditEntry {
  id: string;
  action: string;
  user: User;
  createdAt: string;
  details: Record<string, any>;
}

export default function TripDetail() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [balances, setBalances] = useState<Balances>({});
  const [detailedDebts, setDetailedDebts] = useState<DetailedDebt[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'audit'>('expenses');
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [confirmingExpenseId, setConfirmingExpenseId] = useState<string | null>(null);

  const handleDeleteExpense = async (expenseId: string) => {
    setDeletingExpenseId(expenseId);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete expense');
      }

      // Refresh trip data
      const tripRes = await fetch(`/api/trips/${tripId}`);
      if (tripRes.ok) {
        const tripData = await tripRes.json();
        setTrip(tripData.trip);
        setBalances(tripData.balances);
        setDetailedDebts(tripData.detailedDebts || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setDeletingExpenseId(null);
      setConfirmingExpenseId(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch current user
        const userRes = await fetch('/api/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }

        // Fetch trip data
        const res = await fetch(`/api/trips/${tripId}`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            router.push('/');
            return;
          }
          throw new Error('Failed to fetch trip');
        }
        const data = await res.json();
        setTrip(data.trip);
        setBalances(data.balances);
        setDetailedDebts(data.detailedDebts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (tripId) {
      fetchData();
    }
  }, [tripId, router]);

  useEffect(() => {
    const fetchAuditTrail = async () => {
      if (activeTab !== 'audit') return;

      setAuditLoading(true);
      try {
        const res = await fetch(`/api/audit-trail?tripId=${tripId}`);
        if (!res.ok) throw new Error('Failed to fetch audit trail');
        const data = await res.json();
        setAuditTrail(data.auditTrail || []);
      } catch (err) {
        console.error('Audit trail error:', err);
      } finally {
        setAuditLoading(false);
      }
    };

    if (tripId && activeTab === 'audit') {
      fetchAuditTrail();
    }
  }, [tripId, activeTab]);

  const formatAuditAction = (entry: AuditEntry): string => {
    const details = entry.details as any;
    const user = entry.user?.name || 'Unknown';

    switch (entry.action) {
      case 'trip_created':
        return `${user} created the trip`;
      case 'user_joined':
        return `${user} joined the trip`;
      case 'expense_added':
        return `${user} added an expense: ${details?.description} (${details?.originalAmount} ${details?.originalCurrency})`;
      case 'expense_updated':
        return `${user} updated an expense`;
      case 'expense_deleted':
        return `${user} deleted an expense`;
      default:
        return `${user} performed action: ${entry.action}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading trip...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <p className="text-red-400 mb-6">{error || 'Trip not found'}</p>
          <Link href="/" className="text-indigo-400 hover:text-indigo-300 font-semibold">
            Back to Trips
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white">{trip.name}</h1>
              {trip.description && (
                <p className="text-indigo-100 text-sm mt-1">{trip.description}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white/80 hover:text-white transition flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>
              <Link href="/settings" className="group relative">
                <div className={`w-12 h-12 bg-gradient-to-br ${getAvatarClassByColorId(user?.colorPreference || 'indigo')} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer`}>
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="absolute bottom-full mb-2 right-0 bg-slate-800 text-slate-200 text-xs px-3 py-1 rounded whitespace-nowrap border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  Settings
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Members Section */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/60 rounded-2xl shadow-xl p-6 border border-slate-700 mb-8 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 11a6 6 0 00-5.86 0 3.001 3.001 0 015.86 0zM17.07 11a4 4 0 00-8.14 0z" />
            </svg>
            Trip Members ({trip.members.length})
          </h2>
          <div className="flex flex-wrap gap-3">
            {trip.members.map((member) => (
              <div key={member.user.id} className="bg-slate-700/40 rounded-lg px-4 py-3 border border-slate-600 hover:border-indigo-400/50 transition">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 bg-gradient-to-br ${getAvatarClassByColorId(member.user.colorPreference || 'indigo')} rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md`}>
                    {member.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{member.user.name}</p>
                    <p className="text-slate-400 text-xs">{member.user.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-6 py-3 font-semibold transition border-b-2 whitespace-nowrap ${
              activeTab === 'expenses'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Expenses
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`px-6 py-3 font-semibold transition border-b-2 whitespace-nowrap ${
              activeTab === 'balances'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Balances
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-6 py-3 font-semibold transition border-b-2 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Audit Trail
          </button>
        </div>

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-white">Expenses</h3>
              <Link
                href={`/trips/${tripId}/add-expense`}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-semibold transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Expense
              </Link>
            </div>

            {trip.expenses.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-slate-800 to-slate-800/60 rounded-2xl border border-slate-700">
                <p className="text-slate-400 mb-4">No expenses yet</p>
                <Link
                  href={`/trips/${tripId}/add-expense`}
                  className="text-indigo-300 hover:text-indigo-200 font-semibold"
                >
                  Add your first expense
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {trip.expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="relative h-full"
                    style={{
                      perspective: '1000px',
                    }}
                  >
                    <div
                      className="relative w-full transition-transform duration-300"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: confirmingExpenseId === expense.id ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                    >
                      {/* Front of card - Expense details */}
                      <div
                        className="bg-gradient-to-br from-slate-800 to-slate-800/70 rounded-xl border border-slate-700 hover:border-indigo-400/30 transition shadow-lg p-6"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-lg font-semibold text-white">{expense.description}</h4>
                            <p className="text-slate-400 text-sm">
                              Added by <span className="font-medium text-indigo-400">{expense.creator.name}</span>
                            </p>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            <div>
                              <p className="text-2xl font-bold text-indigo-400">${expense.amountCAD.toFixed(2)}</p>
                              <p className="text-xs text-slate-500">
                                {expense.originalAmount} {expense.originalCurrency}
                                {expense.exchangeRate !== 1 && ` @ ${expense.exchangeRate.toFixed(4)}`}
                              </p>
                            </div>
                            <button
                              onClick={() => setConfirmingExpenseId(expense.id)}
                              disabled={deletingExpenseId === expense.id}
                              className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition disabled:opacity-50 disabled:cursor-not-allowed rounded"
                              title="Delete expense"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="border-t border-slate-700/50 pt-4">
                          <p className="text-sm text-slate-400 mb-3">Split among:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {expense.splits.map((split) => {
                              const splitMember = trip.members.find((m) => m.user.id === split.userId);
                              return (
                                <div key={split.id} className="flex justify-between items-center bg-slate-700/30 px-3 py-2 rounded hover:bg-slate-700/50 transition">
                                  <span className="text-slate-300 text-sm">{splitMember?.user.name}</span>
                                  <span className="font-semibold text-indigo-300">${split.amountCAD.toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-4">
                          {new Date(expense.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {/* Back of card - Confirmation */}
                      <div
                        className="absolute inset-0 bg-gradient-to-br from-red-900/40 to-red-900/20 rounded-xl border border-red-700/50 shadow-lg p-6 flex flex-col items-center justify-center"
                        style={{
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}
                      >
                        <div className="text-center">
                          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2M7.5 3h9A3.5 3.5 0 0120.5 6.5v11A3.5 3.5 0 0117 21H7A3.5 3.5 0 013.5 17.5v-11A3.5 3.5 0 017 3h.5M12 15a3 3 0 100-6 3 3 0 000 6z" />
                            </svg>
                          </div>
                          <p className="text-white font-semibold mb-4">Are you sure?</p>
                          <p className="text-slate-300 text-sm mb-6">This action cannot be undone.</p>
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => setConfirmingExpenseId(null)}
                              disabled={deletingExpenseId === expense.id}
                              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              No
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              disabled={deletingExpenseId === expense.id}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {deletingExpenseId === expense.id ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  Deleting...
                                </>
                              ) : (
                                'Yes, Delete'
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Balances Tab */}
        {activeTab === 'balances' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white">Settlement Summary</h3>

            {detailedDebts.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-slate-800 to-slate-800/60 rounded-2xl border border-slate-700">
                <p className="text-slate-400">All settled up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {detailedDebts.map((debt, idx) => {
                  const fromUser = trip.members.find((m) => m.user.id === debt.from);
                  const toUser = trip.members.find((m) => m.user.id === debt.to);

                  if (!fromUser || !toUser) return null;

                  return (
                    <div
                      key={idx}
                      className="bg-gradient-to-br from-slate-800 to-slate-800/70 rounded-xl border border-slate-700 hover:border-indigo-400/30 transition shadow-lg p-6"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 bg-gradient-to-br ${getAvatarClassByColorId(fromUser.user.colorPreference || 'indigo')} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                                {fromUser.user.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-white font-semibold">{fromUser.user.name}</span>
                            </div>
                            <span className="text-indigo-400 font-bold">owes</span>
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 bg-gradient-to-br ${getAvatarClassByColorId(toUser.user.colorPreference || 'indigo')} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                                {toUser.user.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-white font-semibold">{toUser.user.name}</span>
                            </div>
                          </div>
                          <p className="text-2xl font-bold text-indigo-400 mt-2">${debt.amount.toFixed(2)}</p>
                        </div>

                        <InfoPopover title="How was this calculated?">
                          <BreakdownModal
                            fromName={fromUser.user.name}
                            toName={toUser.user.name}
                            amount={debt.amount}
                            paidByTo={debt.breakdown.paidByTo}
                            paidByFrom={debt.breakdown.paidByFrom}
                            expenses={debt.breakdown.expenses}
                          />
                        </InfoPopover>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white">Audit Trail</h3>

            {auditLoading ? (
              <div className="text-center py-12 bg-gradient-to-br from-slate-800 to-slate-800/60 rounded-2xl border border-slate-700">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">Loading audit trail...</p>
              </div>
            ) : auditTrail.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-slate-800 to-slate-800/60 rounded-2xl border border-slate-700">
                <p className="text-slate-400">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {auditTrail.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="bg-gradient-to-br from-slate-800 to-slate-800/70 rounded-xl border border-slate-700 hover:border-indigo-400/30 transition shadow-lg p-6"
                  >
                    <div className="flex items-start gap-4">
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-indigo-500 rounded-full mt-2"></div>
                        {idx !== auditTrail.length - 1 && (
                          <div className="w-0.5 h-16 bg-slate-700 mt-2"></div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-linear-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {entry.user?.name.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">
                              {formatAuditAction(entry)}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(entry.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Additional details */}
                        {entry.action === 'expense_added' && entry.details && (
                          <div className="mt-3 pl-11 text-xs text-slate-400 bg-slate-700/30 rounded p-3 border border-slate-700/50">
                            <p>Amount: ${entry.details.amountCAD} CAD</p>
                            {entry.details.splits && (
                              <p className="mt-1">Split among {entry.details.splits.length} people</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}