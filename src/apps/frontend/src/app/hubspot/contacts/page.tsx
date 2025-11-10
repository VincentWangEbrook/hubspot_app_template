'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import request from '../../../utils/request';

export default function Dashboard() {
  const [contacts, setContacts] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const jwt = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    if (!jwt) {
      router.replace('/login');
      return;
    }
    const load = () => {
      const activeTenantId = typeof window !== 'undefined' ? localStorage.getItem('activeTenantId') : null;
      if (!activeTenantId) return;
      setLoading(true);
      request.get(`hubspot/contacts?tenantId=${activeTenantId}`)
        .then(res => {
          if (res.data.success) setContacts(res.data.data || []);
          setError(null);
        })
        .catch(err => {
          setError(err?.response?.data?.message || 'Failed to load contacts. Please try again.');
          console.error(err);
        })
        .finally(() => setLoading(false));
    };
    load();
    const handler = () => load();
    window.addEventListener('tenant:changed', handler);
    return () => window.removeEventListener('tenant:changed', handler);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <h2>Contacts</h2>
      <ul>
        {contacts.map((c:any)=> <li key={c.id}>{c.properties?.email || c.id}</li>)}
      </ul>
    </div>
  );
}
