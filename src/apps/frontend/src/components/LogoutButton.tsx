'use client';

import { useRouter, usePathname } from 'next/navigation'; // Use `next/navigation` for App Router (Next.js 13+)
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

// Custom hook to check login status
export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const pathname = usePathname();

  useEffect(() => {
    const jwt = localStorage.getItem('jwt');
    setIsLoggedIn(!!jwt);
  }, [pathname]);

  return isLoggedIn;
}

// Helper function to handle logout logic
async function performLogout(apiFetch: any, router: any) {
  const response = await apiFetch('user/logout', { data: {}});

  if (!response.success) {
    throw new Error(response.message || 'Logout failed unexpectedly');
  }

  localStorage.removeItem('jwt');
  localStorage.removeItem('user');
  router.replace('/login');
}

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isLoggedIn = useAuth(); // Use custom hook for login status

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      await performLogout(apiFetch, router);
    } catch (error) {
      console.error('Logout error:', error);
      alert(error instanceof Error ? error.message : 'Failed to log out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoading}
        aria-busy={isLoading}
        className="px-4 py-2 text-red-600 hover:text-red-800 disabled:opacity-50"
      >
        {isLoading ? 'Logging in...' : 'Log in'}
      </button>
    );
  } else {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoading}
        aria-busy={isLoading}
        className="px-4 py-2 text-red-600 hover:text-red-800 disabled:opacity-50"
      >
        {isLoading ? 'Logging out...' : 'Sign out'}
      </button>
    );
  }
}