'use client'

import React from 'react';
import Sidebar from '../../components/Sidebar';

export default function HubSpotLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: '220px 1fr' }}>
      <Sidebar />
      <section className="p-6">{children}</section>
    </div>
  );
}