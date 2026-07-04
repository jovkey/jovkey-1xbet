/**
 * Interroge le backend jusqu'à ce que le paiement soit confirmé — filet de sécurité
 * si le webhook FedaPay n'a pas encore été délivré (tunnel/réseau en retard).
 */
export async function pollPaymentStatus(
  apiUrl: string,
  paymentId: string,
  maxAttempts = 10,
): Promise<'validated' | 'rejected' | 'pending'> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${apiUrl}/api/payments/fedapay/status/${paymentId}`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.status === 'validated') return 'validated';
      if (data?.status === 'rejected') return 'rejected';
    } catch {
      // on retente
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return 'pending';
}
