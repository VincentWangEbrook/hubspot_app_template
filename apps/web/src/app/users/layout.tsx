'use client'

import React from 'react';

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: '220px 1fr' }}>
      <section className="p-6">{children}</section>
    </div>
  );
}
