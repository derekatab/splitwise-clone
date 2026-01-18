'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { userColorPalette, getAvatarClassByColorId } from '@/lib/utils/userColors';

interface User {
  id: string;
  name: string;
  email: string;
  colorPreference?: string;
}

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/');
          return;
        }
        const data = await res.json();
        setUser(data.user);
        setSelectedColor(data.user.colorPreference || userColorPalette[0].id);
      } catch (err) {
        console.error('Error:', err);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleColorChange = async (colorId: string) => {
    setSelectedColor(colorId);
    setSaving(true);
    try {
      const res = await fetch('/api/user/color-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colorPreference: colorId }),
      });

      if (!res.ok) throw new Error('Failed to save color preference');

      setMessage({ type: 'success', text: 'Color preference updated!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save color preference' });
    } finally {
      setSaving(false);
    }
  };

  const handleResendInvite = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/resend-invite', {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to resend invite');

      setMessage({ type: 'success', text: 'Invitation email sent! Check your inbox.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send invitation email' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
              <p className="text-indigo-100 text-sm mt-1">Manage your profile and preferences</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white/80 hover:text-white transition flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>
              <div className={`w-12 h-12 bg-gradient-to-br ${getAvatarClassByColorId(user?.colorPreference || 'indigo')} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Profile Section */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/60 rounded-2xl shadow-xl p-8 border border-slate-700 mb-8 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Profile Information
          </h2>

          <div className="space-y-6">
            <div className="flex items-start gap-6">
              <div className={`w-20 h-20 bg-gradient-to-br ${getAvatarClassByColorId(selectedColor)} rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-slate-400 text-sm mb-1">Name</p>
                <p className="text-white font-semibold text-lg">{user.name}</p>
                <p className="text-slate-400 text-sm mt-3 mb-1">Email</p>
                <p className="text-white font-semibold">{user.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Color Preference Section */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/60 rounded-2xl shadow-xl p-8 border border-slate-700 mb-8 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Choose Your Color
          </h2>

          <p className="text-slate-300 mb-6">Select a color for your profile avatar and appearance throughout the app</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {userColorPalette.map((color) => (
              <button
                key={color.id}
                onClick={() => handleColorChange(color.id)}
                disabled={saving}
                className={`group relative p-4 rounded-xl transition-all duration-200 ${
                  selectedColor === color.id
                    ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white shadow-xl'
                    : 'hover:scale-105'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-full aspect-square bg-gradient-to-br ${color.bgDark} rounded-lg flex items-center justify-center text-white text-2xl font-bold shadow-md`}>
                  {color.name.charAt(0)}
                </div>
                <p className="text-slate-300 text-sm font-medium mt-2 text-center">{color.name}</p>

                {selectedColor === color.id && (
                  <div className="absolute top-2 right-2 bg-white rounded-full p-1">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Device & Invitations Section */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/60 rounded-2xl shadow-xl p-8 border border-slate-700 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Devices & Invitations
          </h2>

          <p className="text-slate-300 mb-6">
            Send yourself an invitation email to add additional devices or if you need to set up a new browser session.
          </p>

          <button
            onClick={handleResendInvite}
            disabled={saving}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {saving ? 'Sending...' : 'Resend Invitation Email'}
          </button>

          <p className="text-slate-400 text-sm mt-3">
            You'll receive an email at <span className="text-indigo-400">{user.email}</span> with a link to set up a new device.
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
            {message.type === 'success' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span>{message.text}</span>
          </div>
        )}
      </main>
    </div>
  );
}
