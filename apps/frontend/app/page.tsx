import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ padding: 20 }}>
      <h1>HubSpot App Frontend</h1>
      <ul>
        <li><Link href='/login'>Login / Connect HubSpot</Link></li>
        <li><Link href='/dashboard'>Dashboard</Link></li>
        <li><Link href='/subscription'>Subscription</Link></li>
      </ul>
    </div>
  );
}
