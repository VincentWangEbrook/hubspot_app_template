'use client'

import React, { useEffect, useState } from 'react';
import request from '../../utils/request';

export default function Dashboard() {
  const [contacts, setContacts] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    request.get(`hubspot/contacts?tenantId=${process.env.NEXT_PUBLIC_TENANT_ID || 'default_tenant'}`)
      .then(res => {
        if (res.data.success) setContacts(res.data.data || []);
        setError(null);
      })
      .catch(err => {
        setError('Failed to load contacts. Please try again.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>
      <h2>Contacts</h2>
      <ul>
        {contacts.map((c:any)=> <li key={c.id}>{c.properties?.email || c.id}</li>)}
      </ul>
    </div>
  );
}
