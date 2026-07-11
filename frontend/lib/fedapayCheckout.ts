export type PaymentPurpose = 'gold_subscription' | 'investor_deposit';
export interface PaymentPollResult {
  status: 'validated' | 'rejected' | 'pending';
  purpose: PaymentPurpose | null;
}

/**
 * Interroge le backend jusqu'à ce que le paiement soit confirmé — filet de sécurité
 * si le webhook FedaPay n'a pas encore été délivré (tunnel/réseau en retard).
 */
export async function pollPaymentStatus(
  apiUrl: string,
  paymentId: string,
  maxAttempts = 10,
): Promise<PaymentPollResult> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${apiUrl}/api/payments/fedapay/status/${paymentId}`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.status === 'validated' || data?.status === 'rejected') {
        return { status: data.status, purpose: data.purpose ?? null };
      }
    } catch {
      // on retente
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { status: 'pending', purpose: null };
}
