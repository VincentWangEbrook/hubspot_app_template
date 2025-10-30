'use client';

import { useRouter } from 'next/navigation'; // Use `next/navigation` for App Router (Next.js 13+)
import { useState } from 'react';
import { apiFetch } from '../lib/api';

export default function LogoutButton() {
  const router = useRouter(); // Updated for App Router (replace with `useRouter` from 'next/router' if using Pages Router)
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLogout = async () => {
    if (isLoading) return; // Prevent duplicate clicks
    setIsLoading(true);

    try {
      // Call logout API (expecting a success response)
      const response = await apiFetch<{ success: boolean; message?: string }>('user/logout', { data: {}});

      if (!response.success) {
        throw new Error(response.message || 'Logout failed unexpectedly');
      }

      // Clear auth state
      localStorage.removeItem('jwt');
      
      // Optional: Clear other related storage (e.g., user data)
      localStorage.removeItem('user');

      // Redirect to login (use `router.push` for Pages Router)
      router.replace('/login'); 
    } catch (error) {
      console.error('Logout error:', error);
      // Show user-friendly error (consider using a toast library instead of alert)
      alert(error instanceof Error ? error.message : 'Failed to log out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      aria-busy={isLoading} // Accessibility: Indicate loading state to screen readers
      className="px-4 py-2 text-red-600 hover:text-red-800 disabled:opacity-50" // Example styling
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
}