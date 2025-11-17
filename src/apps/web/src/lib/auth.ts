'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from './apiFetch';
import { UserInfo } from '../types';

export function useAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiFetch<any>('/auth/me', { credentials: 'include' })
      .then((res) => {
        if (res.success && res.data && res.data.user) setUser(res.data.user);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { user, isLoading, isLoggedIn: !!user };
}
