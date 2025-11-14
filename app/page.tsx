'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Trip {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  members: Array<{ user: { name: string; email: string } }>;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function Home() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check authentication
        const userRes = await fetch('/api/auth/me');
        if (!userRes.ok) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        const userData = await userRes.json();
        setUser(userData.user);

        // Fetch trips
        const tripsRes = await fetch('/api/trips/list');
        if (tripsRes.ok) {
          const tripsData = await tripsRes.json();
          setTrips(tripsData.trips || []);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your trips...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full">
          <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Access Required</h1>
            </div>

            <p className="text-slate-300 text-center mb-2">
              You don't have access to Splitwise yet.
            </p>
            <p className="text-slate-400 text-center text-sm mb-6">
              Ask the architect of this project to send you an invite link.
            </p>

            <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
              <p className="text-slate-300 text-center text-sm">
                <strong>Contact:</strong>
              </p>
              <a
                href="mailto:derekatabayev4@gmail.com"
                className="text-indigo-400 hover:text-indigo-300 font-semibold text-center block mt-2 transition"
              >
                derekatabayev4@gmail.com
              </a>
            </div>

            <p className="text-xs text-slate-500 text-center">
              Once you receive an invite link, click it to set up your profile and access your trips.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Splitwise</h1>
              <p className="text-slate-400 text-sm mt-1">Track expenses with ease</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white font-medium">{user?.name}</p>
                <p className="text-slate-400 text-sm">{user?.email}</p>
              </div>
              <div className="w-10 h-10 bg-linear-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <div>
            <h2 className="text-4xl font-bold text-white mb-2">Your Trips</h2>
            <p className="text-slate-400">View and manage shared expenses across your trips</p>
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No trips yet</h3>
            <p className="text-slate-400 mb-8">You haven't been invited to any trips yet. Ask the admin to send you an invite link!</p>
            <div className="inline-block bg-slate-800 rounded-lg px-6 py-4 border border-slate-700">
              <p className="text-slate-300 text-sm">
                <strong>Admin Contact:</strong>
              </p>
              <a
                href="mailto:derekatabayev4@gmail.com"
                className="text-indigo-400 hover:text-indigo-300 font-semibold mt-2 inline-block transition"
              >
                derekatabayev4@gmail.com
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <div className="group bg-slate-800 rounded-xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 transition transform hover:scale-105 border border-slate-700 hover:border-indigo-500 overflow-hidden cursor-pointer h-full">
                  <div className="p-6 flex flex-col h-full">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition">
                      {trip.name}
                    </h3>
                    {trip.description && (
                      <p className="text-slate-400 text-sm mb-4 grow line-clamp-2">
                        {trip.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700">
                      <div className="flex -space-x-2">
                        {trip.members?.slice(0, 3).map((member, idx) => (
                          <div
                            key={idx}
                            className="w-8 h-8 bg-linear-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-slate-800"
                            title={member.user.name}
                          >
                            {member.user.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {trip.members && trip.members.length > 3 && (
                          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 text-xs font-bold border-2 border-slate-800">
                            +{trip.members.length - 3}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(trip.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}