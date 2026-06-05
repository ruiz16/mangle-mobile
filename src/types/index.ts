// =============================================================================
// Mangle — Shared Types
// =============================================================================

/** GACC member */
export interface Member {
  name: string;
  role: string;
  status: 'Al día' | 'En Alerta';
  score: number;
  self: boolean;
}

/** Chat step in the education module */
export interface EduStep {
  sender: 'system' | 'whatsapp_fld';
  msg: string;
  time: string;
}

/** Category for loan purpose */
export type LoanCategory = 'insumos' | 'herramientas' | 'mercancia';

export const LOAN_CATEGORIES: { key: LoanCategory; label: string; icon: string }[] = [
  { key: 'insumos', label: 'Insumos', icon: 'basket-shopping' },
  { key: 'herramientas', label: 'Herramientas', icon: 'screwdriver-wrench' },
  { key: 'mercancia', label: 'Mercancía', icon: 'box' },
];

/** GACC mode during registration */
export type GaccMode = 'join' | 'create';

/** Municipios */
export type Municipio = 'guapi' | 'timbiqui';

/** Navigation tab */
export type NavTab = 'education' | 'request' | 'gacc' | 'repayment' | 'credential';

// =============================================================================
// App State
// =============================================================================

export interface AppState {
  // Wallet
  walletConnected: boolean;
  walletAddress: string | null;

  // User profile
  registered: boolean;
  fullName: string;
  role: string;
  phone: string;
  municipio: Municipio;
  referidora: string;

  // GACC
  gaccMode: GaccMode;
  gaccCode: string;
  gaccName: string;
  gaccMembers: Member[];

  // Education
  eduProgress: number; // 0–100
  currentEduStep: number;

  // Credit
  selectedAmount: number;
  category: LoanCategory;
  creditApproved: boolean;
  installmentsPaid: number;
  totalInstallments: number;

  // Reputation
  reputation: number; // 0–100

  // Alerts
  nodeAlert: boolean;
  alertPartnerName: string;
}

// =============================================================================
// Default state
// =============================================================================

export function createDefaultState(): AppState {
  return {
    walletConnected: false,
    walletAddress: null,
    registered: false,
    fullName: '',
    role: '',
    phone: '',
    municipio: 'guapi',
    referidora: '',
    gaccMode: 'join',
    gaccCode: '',
    gaccName: '',
    gaccMembers: [],
    eduProgress: 0,
    currentEduStep: 1,
    selectedAmount: 100000,
    category: 'insumos',
    creditApproved: false,
    installmentsPaid: 0,
    totalInstallments: 4,
    reputation: 80,
    nodeAlert: false,
    alertPartnerName: '',
  };
}
