// =============================================================================
// Mangle — Shared Types
// =============================================================================

/** GACC member — aligned with web's gacc_miembros + participantes join */
export interface Member {
  id: string;             // gacc_miembros.id
  participanteId: string; // gacc_miembros.participante_id
  name: string;           // participantes.nombre
  role: string;           // participantes.rol
  status: 'Al día' | 'En Alerta';
  score: number;          // participantes.score_reputacion
  validado: boolean;      // gacc_miembros.validado_en IS NOT NULL
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

/** Credit state — aligned with web app (pendiente → desembolsado → pagado) */
export type CreditEstado = 'ninguno' | 'pendiente' | 'desembolsado' | 'pagado';

/** Currency type — COPm (local currency) or cUSD (Celo Dollar) */
export type Moneda = 'COPm' | 'cUSD';

/** Navigation tab */
export type NavTab = 'education' | 'request' | 'gacc' | 'repayment' | 'credential';

// =============================================================================
// App State
// =============================================================================

export interface AppState {
  // Wallet
  walletConnected: boolean;
  walletAddress: string | null;
  copmBalance: string;

  // User profile
  registered: boolean;
  fullName: string;
  email: string;
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
  creditEstado: CreditEstado;
  moneda: Moneda;
  montoCusd: number;
  tasaCambio: number;
  installmentsPaid: number;
  totalInstallments: number;

  // SIWE Auth
  siweMessage: string | null;
  siweSignature: `0x${string}` | null;
  authToken: string | null;
  refreshToken: string | null;

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
    copmBalance: '0.00',
    registered: false,
    fullName: '',
    email: '',
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
    creditEstado: 'ninguno',
    moneda: 'COPm',
    montoCusd: 0,
    tasaCambio: 3633.45,
    installmentsPaid: 0,
    totalInstallments: 4,
    siweMessage: null,
    siweSignature: null,
    authToken: null,
    refreshToken: null,
    reputation: 50,
    nodeAlert: false,
    alertPartnerName: '',
  };
}
