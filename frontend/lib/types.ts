export type Role = 'gold' | 'investor' | 'admin' | 'superadmin';

export interface AuthUser {
  id: string;
  email: string | null;
  role: Role;
  id1xbet?: string | null;
}

export interface Prediction {
  id: string;
  sport: string;
  match: string;
  market: string;
  selection: string;
  odds: number;
  reliability: number;
  couponCode: string;
  tier: string;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  isSeed: boolean;
}

export interface CarouselSlide {
  id: string;
  imageUrl: string;
  caption?: string;
  linkTunnel: string;
}

export interface MarqueeMessage {
  id: string;
  text: string;
}

export interface PublicCmsConfig {
  slides: CarouselSlide[];
  marquee: MarqueeMessage[];
  settings: Record<string, any>;
}

export type PaymentStatus = 'pending' | 'validated' | 'rejected';
export type WithdrawalStatus = 'pending' | 'validated' | 'rejected' | 'paid';
export type PaymentPurpose = 'gold_subscription' | 'investor_deposit';

export interface Payment {
  id: string;
  amount: string | number;
  currency: string;
  method: string;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  reference?: string;
  createdAt: string;
  user?: { id1xbet: string; whatsappNum: string; role?: string; country?: string };
}

export interface Withdrawal {
  id: string;
  amount: string | number;
  method: string;
  destination?: string;
  status: WithdrawalStatus;
  createdAt: string;
  user?: { id1xbet: string; whatsappNum: string; country?: string };
}

export interface InvestorBalances {
  withdrawable: number;
  underAnalysis: number;
  frozen: number;
}

export interface InvestorDashboardData {
  cycleMonth: string;
  currency: string;
  balances: InvestorBalances;
  capital: number;
  pnl: number;
  roiPct: number;
  performance: { day: string; value: number }[];
  reviewsGate: { written: number; required: number; unlocked: boolean };
  payments: Payment[];
  withdrawals: Withdrawal[];
}
