'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Trip {
  id: string;
  name: string;
}

interface InviteResult {
  email: string;
  status: 'sending' | 'sent' | 'error';
  message?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function AdminInvites() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>('');
  const [email, setEmail] = useState('');
  const [emails, setEmails] = useState<string>('');
  const [adminKey, setAdminKey] = useState('');
  const [storedAdminKey, setStoredAdminKey] = useState<string | null>(null); // Keep it after validation
  const [keyValidated, setKeyValidated] = useState(false);
  const [deviceSetup, setDeviceSetup] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<InviteResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // Check if device is already set up
  useEffect(() => {
    const checkDevice = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setAdminUser(data.user);
          setDeviceSetup(true);
        }
      } catch (err) {
        console.error('Device check failed:', err);
      }
    };

    checkDevice();
  }, []);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const res = await fetch('/api/trips/list');
        if (res.ok) {
          const data = await res.json();
          setTrips(data.trips || []);
        }
      } catch (err) {
        console.error('Failed to fetch trips:', err);
      }
    };

    if (keyValidated && deviceSetup) {
      fetchTrips();
    }
  }, [keyValidated, deviceSetup]);

  const handleValidateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!adminKey.trim()) {
      setError('Please enter your admin secret key');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Invalid admin secret key');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.valid) {
        setKeyValidated(true);
        setStoredAdminKey(adminKey); // Store the key for later use
        setError(null);
      } else {
        setError(data.error || 'Invalid admin secret key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: adminName, email: adminEmail }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to setup device');
      }

      const data = await res.json();
      setAdminUser(data.user);
      setDeviceSetup(true);
      setAdminName('');
      setAdminEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSingleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResults([]);
    setError(null);

    try {
      const res = await fetch('/api/admin/invites/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${storedAdminKey}`, // Use stored key
        },
        body: JSON.stringify({
          tripId: selectedTrip,
          email,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to send invite');
        setResults([{ email, status: 'error', message: data.error }]);
      } else {
        const data = await res.json();
        setResults([{ email, status: 'sent', message: data.message }]);
        setEmail('');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMsg);
      setResults([{ email, status: 'error', message: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResults([]);
    setError(null);

    const emailList = emails
      .split(/[\n,]/)
      .map((e) => e.trim())
      .filter((e) => e);

    const newResults: InviteResult[] = [];

    for (const recipientEmail of emailList) {
      try {
        newResults.push({ email: recipientEmail, status: 'sending' });
        setResults([...newResults]);

        const res = await fetch('/api/admin/invites/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${storedAdminKey}`, // Use stored key
          },
          body: JSON.stringify({
            tripId: selectedTrip,
            email: recipientEmail,
          }),
        });

        if (res.ok) {
          const idx = newResults.findIndex((r) => r.email === recipientEmail);
          newResults[idx].status = 'sent';
          newResults[idx].message = 'Invite sent successfully';
        } else {
          const data = await res.json();
          const idx = newResults.findIndex((r) => r.email === recipientEmail);
          newResults[idx].status = 'error';
          newResults[idx].message = data.error;
        }
        setResults([...newResults]);

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        const idx = newResults.findIndex((r) => r.email === recipientEmail);
        newResults[idx].status = 'error';
        newResults[idx].message = err instanceof Error ? err.message : 'Unknown error';
        setResults([...newResults]);
      }
    }

    setLoading(false);
    setEmails('');
  };

  // Step 1: Key validation
  if (!keyValidated) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
              <Link href="/" className="text-slate-400 hover:text-white transition flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Admin Authentication Required</h2>
              <p className="text-slate-400">Enter your admin secret key to continue</p>
            </div>

            <form onSubmit={handleValidateKey} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Admin Secret Key
                </label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Paste your ADMIN_SECRET_KEY here..."
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition outline-none"
                  required
                />
                <p className="text-xs text-slate-500 mt-2">
                  This key is stored in your .env file locally. Only use this on localhost.
                </p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg transition font-semibold shadow-lg hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Validating...
                  </div>
                ) : (
                  'Unlock Admin Panel'
                )}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-slate-700">
              <p className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zm3 1a1 1 0 100-2 1 1 0 000 2zm2-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                </svg>
                <strong>Security Note:</strong>
              </p>
              <p className="text-xs text-slate-500">
                This admin panel should only be used on localhost. The admin secret key provides full access to send invites to any trip. Keep it secure and never share it.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Step 2: Device setup
  if (!deviceSetup) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
              <Link href="/" className="text-slate-400 hover:text-white transition flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Setup Your Profile</h2>
              <p className="text-slate-400">Create your device profile to access the admin panel</p>
            </div>

            <form onSubmit={handleSetupDevice} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Derek"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Your Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="derek@example.com"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition outline-none"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !adminName.trim() || !adminEmail.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg transition font-semibold shadow-lg hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Setting up...
                  </div>
                ) : (
                  'Setup Profile'
                )}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }


  // Step 3: Admin panel fully unlocked
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
              <p className="text-slate-400 text-sm mt-1">Send trip invitations</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-300 font-medium">Authenticated</span>
              </div>
              <Link href="/" className="text-slate-400 hover:text-white transition flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Trip Selection */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-700 sticky top-24">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000-2H2a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1V5a1 1 0 00-1-1h-2.586A1 1 0 0010 2.414L8 .586A1 1 0 006.586 0h-2A1 1 0 004 1v4zm0 5a1 1 0 000-2 1 1 0 000 2zm5 0a1 1 0 000-2 1 1 0 000 2zm5 0a1 1 0 000-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Select Trip
              </h3>

              {trips.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm">No trips available</p>
                  <Link href="/trips/create" className="text-indigo-400 hover:text-indigo-300 text-sm mt-3 inline-block">
                    Create one first
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedTrip}
                  onChange={(e) => setSelectedTrip(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition outline-none"
                >
                  <option value="">Choose a trip...</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name}
                    </option>
                  ))}
                </select>
              )}

              {selectedTrip && (
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <p className="text-xs text-slate-500 mb-3">
                    <strong>Selected Trip:</strong>
                  </p>
                  <div className="bg-indigo-500/20 border border-indigo-500/50 rounded-lg p-3">
                    <p className="text-indigo-300 font-semibold text-sm">
                      {trips.find((t) => t.id === selectedTrip)?.name}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Content - Invite Forms */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-700">
              <button
                onClick={() => setActiveTab('single')}
                className={`px-6 py-3 font-semibold transition border-b-2 ${
                  activeTab === 'single'
                    ? 'text-indigo-400 border-indigo-500'
                    : 'text-slate-400 border-transparent hover:text-slate-300'
                }`}
              >
                <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 01-5 0V12m0 0V8m0 4v1.5a2.5 2.5 0 01-5 0V12" />
                </svg>
                Single Invite
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`px-6 py-3 font-semibold transition border-b-2 ${
                  activeTab === 'bulk'
                    ? 'text-indigo-400 border-indigo-500'
                    : 'text-slate-400 border-transparent hover:text-slate-300'
                }`}
              >
                <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10h.01M13 10h.01M11 10h.01M9 10h.01" />
                </svg>
                Bulk Invites
              </button>
            </div>

            {/* Single Invite Form */}
            {activeTab === 'single' && (
              <form onSubmit={handleSingleInvite} className="bg-slate-800 rounded-2xl shadow-lg p-8 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-6">Send Single Invite</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition outline-none"
                      required
                    />
                  </div>

                  {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
                      <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !selectedTrip || !email}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold shadow-lg hover:shadow-indigo-500/50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Sending...
                      </div>
                    ) : (
                      'Send Invite'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Bulk Invite Form */}
            {activeTab === 'bulk' && (
              <form onSubmit={handleBulkInvite} className="bg-slate-800 rounded-2xl shadow-lg p-8 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-6">Send Bulk Invites</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      Email Addresses <span className="text-red-400">*</span>
                    </label>
                    <p className="text-xs text-slate-400 mb-3">
                      Enter one email per line or separate by commas
                    </p>
                    <textarea
                      value={emails}
                      onChange={(e) => setEmails(e.target.value)}
                      placeholder="email1@example.com&#10;email2@example.com&#10;email3@example.com"
                      rows={6}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition outline-none resize-none font-mono text-sm"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
                      <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !selectedTrip || !emails.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold shadow-lg hover:shadow-indigo-500/50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Sending...
                      </div>
                    ) : (
                      'Send Bulk Invites'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Results Section */}
            {results.length > 0 && (
              <div className="mt-8 bg-slate-800 rounded-2xl shadow-lg p-8 border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  Invite Results
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border flex items-start gap-3 ${
                        result.status === 'sent'
                          ? 'bg-green-500/10 border-green-500/50'
                          : result.status === 'error'
                          ? 'bg-red-500/10 border-red-500/50'
                          : 'bg-blue-500/10 border-blue-500/50'
                      }`}
                    >
                      <div className="mt-1 shrink-0">
                        {result.status === 'sent' ? (
                          <div className="w-5 h-5 text-green-400 flex items-center justify-center">
                            <svg fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : result.status === 'error' ? (
                          <div className="w-5 h-5 text-red-400 flex items-center justify-center">
                            <svg fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 text-blue-400 flex items-center justify-center animate-spin">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="grow">
                        <p className={`font-medium text-sm ${
                          result.status === 'sent'
                            ? 'text-green-300'
                            : result.status === 'error'
                            ? 'text-red-300'
                            : 'text-blue-300'
                        }`}>
                          {result.email}
                        </p>
                        {result.message && (
                          <p className={`text-xs mt-1 ${
                            result.status === 'sent'
                              ? 'text-green-200'
                              : result.status === 'error'
                              ? 'text-red-200'
                              : 'text-blue-200'
                          }`}>
                            {result.message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
