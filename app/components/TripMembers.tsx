'use client';

import { useState } from 'react';
import { getAvatarClassByColorId } from '@/lib/utils/userColors';

export interface TripMemberUser {
  id: string;
  name: string;
  email: string | null;
  colorPreference?: string;
  _count?: { devices: number };
}

export interface TripMemberItem {
  user: TripMemberUser;
}

interface Props {
  tripId: string;
  members: TripMemberItem[];
  /** User id of the trip creator, who is the only one allowed to manage members. */
  adminId: string;
  currentUserId: string | null;
  /** Called after any change so the parent can reload trip data (members + balances). */
  onMembersChanged: () => Promise<void> | void;
}

type Notice = { type: 'success' | 'error'; text: string } | null;

const inputClass =
  'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition outline-none';
const primaryBtn =
  'bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryBtn =
  'bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
const iconBtn =
  'p-1.5 rounded text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition disabled:opacity-50 disabled:cursor-not-allowed';
const iconBtnDanger =
  'p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50 disabled:cursor-not-allowed';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export default function TripMembers({ tripId, members, adminId, currentUserId, onMembersChanged }: Props) {
  const isAdmin = currentUserId !== null && currentUserId === adminId;

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // "add" or the user id being acted on
  const [notice, setNotice] = useState<Notice>(null);

  const fail = (err: unknown, fallback: string) =>
    setNotice({ type: 'error', text: err instanceof Error ? err.message : fallback });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('add');
    setNotice(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Failed to add member'));
      const data = await res.json();
      const addedName = data.member?.user?.name || newName.trim();
      const addedEmail = data.member?.user?.email;

      if (data.inviteError) {
        setNotice({ type: 'error', text: data.inviteError });
      } else if (data.inviteSent) {
        setNotice({ type: 'success', text: `${addedName} added and an invite was sent to ${addedEmail}.` });
      } else {
        setNotice({
          type: 'success',
          text: `${addedName} added without an email. They can be included in expenses right away; add their email later to invite them.`,
        });
      }
      setNewName('');
      setNewEmail('');
      setShowAddForm(false);
      await onMembersChanged();
    } catch (err) {
      fail(err, 'Failed to add member');
    } finally {
      setBusy(null);
    }
  };

  const startEdit = (member: TripMemberItem) => {
    setEditingId(member.user.id);
    setEditName(member.user.name);
    setEditEmail(member.user.email ?? '');
    setConfirmRemoveId(null);
    setNotice(null);
  };

  const handleSaveEdit = async (e: React.FormEvent, userId: string) => {
    e.preventDefault();
    setBusy(userId);
    setNotice(null);
    try {
      const payload: { name: string; email?: string } = { name: editName };
      if (editEmail.trim()) payload.email = editEmail;

      const res = await fetch(`/api/trips/${tripId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readError(res, 'Failed to update member'));
      const data = await res.json();

      if (data.inviteError) {
        setNotice({ type: 'error', text: data.inviteError });
      } else if (data.inviteSent) {
        setNotice({ type: 'success', text: `Saved. An invite was sent to ${data.member?.user?.email}.` });
      } else {
        setNotice({ type: 'success', text: 'Member updated.' });
      }
      setEditingId(null);
      await onMembersChanged();
    } catch (err) {
      fail(err, 'Failed to update member');
    } finally {
      setBusy(null);
    }
  };

  const handleResend = async (member: TripMemberItem) => {
    if (!member.user.email) return;
    setBusy(member.user.id);
    setNotice(null);
    try {
      const res = await fetch('/api/invites/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, email: member.user.email }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Failed to send invite'));
      setNotice({ type: 'success', text: `Invite sent to ${member.user.email}.` });
    } catch (err) {
      fail(err, 'Failed to send invite');
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (member: TripMemberItem) => {
    setBusy(member.user.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/members/${member.user.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res, 'Failed to remove member'));
      setNotice({ type: 'success', text: `${member.user.name} was removed from the trip.` });
      setConfirmRemoveId(null);
      await onMembersChanged();
    } catch (err) {
      fail(err, 'Failed to remove member');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/60 rounded-2xl shadow-xl p-6 border border-slate-700 mb-8 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 11a6 6 0 00-5.86 0 3.001 3.001 0 015.86 0zM17.07 11a4 4 0 00-8.14 0z" />
          </svg>
          Trip Members ({members.length})
        </h2>
        {isAdmin && !showAddForm && (
          <button
            type="button"
            onClick={() => {
              setShowAddForm(true);
              setEditingId(null);
              setConfirmRemoveId(null);
              setNotice(null);
            }}
            className={`${primaryBtn} flex items-center gap-2`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add member
          </button>
        )}
      </div>

      {isAdmin && showAddForm && (
        <form onSubmit={handleAdd} className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className={inputClass}
              required
              autoFocus
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email (optional)"
              className={inputClass}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Leave the email blank to add someone now and invite them later. With an email, they get an invite link right away.
          </p>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={busy === 'add'} className={primaryBtn}>
              {busy === 'add' ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              disabled={busy === 'add'}
              onClick={() => {
                setShowAddForm(false);
                setNewName('');
                setNewEmail('');
              }}
              className={secondaryBtn}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {notice && (
        <div
          className={`border px-4 py-3 rounded-lg text-sm mb-4 flex items-start justify-between gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-red-500/20 border-red-500/50 text-red-300'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {members.map((member) => {
          const u = member.user;
          const isTripAdmin = u.id === adminId;
          const hasSignedIn = (u._count?.devices ?? 0) > 0;
          const canManage = isAdmin && !isTripAdmin;
          const isBusy = busy === u.id;

          if (editingId === u.id) {
            return (
              <form
                key={u.id}
                onSubmit={(e) => handleSaveEdit(e, u.id)}
                className="bg-slate-700/40 rounded-lg px-4 py-3 border border-indigo-400/60 w-full md:w-auto md:min-w-[24rem]"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Name"
                    className={inputClass}
                    required
                    autoFocus
                  />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email (optional)"
                    className={inputClass}
                  />
                </div>
                {!u.email && (
                  <p className="text-xs text-slate-400 mt-2">Adding an email sends {u.name} an invite to join.</p>
                )}
                <div className="flex gap-2 mt-3">
                  <button type="submit" disabled={isBusy} className={primaryBtn}>
                    {isBusy ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" disabled={isBusy} onClick={() => setEditingId(null)} className={secondaryBtn}>
                    Cancel
                  </button>
                </div>
              </form>
            );
          }

          return (
            <div
              key={u.id}
              className="bg-slate-700/40 rounded-lg px-4 py-3 border border-slate-600 hover:border-indigo-400/50 transition"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 bg-gradient-to-br ${getAvatarClassByColorId(
                    u.colorPreference || 'indigo'
                  )} rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md`}
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm flex items-center gap-2">
                    {u.name}
                    {isTripAdmin && (
                      <span className="text-[10px] uppercase tracking-wide bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 rounded px-1.5 py-0.5">
                        Admin
                      </span>
                    )}
                    {!isTripAdmin && u.id === currentUserId && (
                      <span className="text-[10px] uppercase tracking-wide bg-slate-600/60 text-slate-300 border border-slate-500/60 rounded px-1.5 py-0.5">
                        You
                      </span>
                    )}
                  </p>
                  {u.email ? (
                    <p className="text-slate-400 text-xs">
                      {u.email}
                      {!hasSignedIn && <span className="text-slate-500"> (invited)</span>}
                    </p>
                  ) : (
                    <p className="text-slate-500 text-xs italic">No email yet</p>
                  )}
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 ml-2">
                    {confirmRemoveId === u.id ? (
                      <>
                        <span className="text-xs text-slate-300 mr-1">Remove?</span>
                        <button
                          type="button"
                          onClick={() => handleRemove(member)}
                          disabled={isBusy}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded font-semibold disabled:opacity-50"
                        >
                          {isBusy ? '...' : 'Yes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          disabled={isBusy}
                          className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded font-semibold disabled:opacity-50"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        {!hasSignedIn && (
                          <button type="button" title="Edit name or email" onClick={() => startEdit(member)} className={iconBtn}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                        {u.email && !hasSignedIn && (
                          <button type="button" title="Resend invite" onClick={() => handleResend(member)} disabled={isBusy} className={iconBtn}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          title="Remove from trip"
                          onClick={() => {
                            setConfirmRemoveId(u.id);
                            setEditingId(null);
                          }}
                          disabled={isBusy}
                          className={iconBtnDanger}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
