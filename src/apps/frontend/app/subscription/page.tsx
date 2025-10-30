import React from 'react';
import axios from 'axios';

export default function Subscription() {
  async function startCheckout() {
    const res = await axios.post('/subscription/create-checkout-session', {
      tenantId: 'tenant_demo',
      successUrl: window.location.origin + '/subscription-success',
      cancelUrl: window.location.origin + '/subscription-cancel',
    });
    if (res.data?.url) {
      window.location.href = res.data.url;
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Subscription</h1>
      <button onClick={startCheckout}>Start Checkout</button>
    </div>
  );
}
