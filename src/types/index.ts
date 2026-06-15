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

/** Category for loan purpose */
export type LoanCategory = 'insumos' | 'herramientas' | 'mercancia';

export const LOAN_CATEGORIES: { key: LoanCategory; label: string; icon: string }[] = [
  { key: 'insumos', label: 'Insumos', icon: 'basket-shopping' },
  { key: 'herramientas', label: 'Herramientas', icon: 'screwdriver-wrench' },
  { key: 'mercancia', label: 'Mercancía', icon: 'box' },
];

/** Municipios */
export type Municipio = 'guapi' | 'timbiqui';

/** Credit state — aligned with web app (pendiente → desembolsado → pagado) */
export type CreditEstado = 'ninguno' | 'pendiente' | 'desembolsado' | 'pagado';

/** Navigation tab */
export type NavTab = 'education' | 'request' | 'gacc' | 'repayment' | 'credential';

/**
 * Auth flow step — used by useAuth() hook to drive the Connect page UI
 * and prevent duplicate SIWE attempts.
 *
 * ┌─ idle ──→ checking_session ──→ authenticated (if session valid)
 *                                ──→ connecting_wallet → fetch_nonce → signing → exchanging → authenticated
 *                                                                                               ──→ error
 */
export type AuthStep =
  | 'idle'
  | 'checking_session'
  | 'connecting_wallet'
  | 'fetching_nonce'
  | 'signing'
  | 'exchanging'
  | 'authenticated'
  | 'error';

// =============================================================================
// API Response Types (from mangle-app backend)
// =============================================================================

/** Enriched cuota from GET /api/mis-cuotas — aligned with mangle-app's EnrichedCuota */
export interface ApiCuota {
  id: string;
  credito_id: string;
  credito_monto: string;
  credito_estado: string;
  credito_descripcion: string | null;
  credito_referadora_nombre: string | null;
  numero_cuota: number;
  total_cuotas: number;
  monto_capital: string;
  monto_interes: string;
  monto_cuota: string;    // COPm (decimal string)
  saldo_restante: string;  // COPm
  fecha_vencimiento: string;
  estado: 'pendiente' | 'pagada' | 'vencida';
  tx_hash_pago: string | null;
  fecha_pago: string | null;
  credito_repayment_mode: string;
}

/** Response from GET /api/mis-cuotas */
export interface MisCuotasResponse {
  cuotas: ApiCuota[];
}

/** Pago config from GET /api/mobile/pago-config */
export interface PagoConfig {
  copmAddress: `0x${string}`;
  platformWallet: `0x${string}`;
  lendingPoolAddress: `0x${string}`;
}

/** Body for POST /api/pago */
export interface PagoRequestBody {
  cuota_id: string;
  tx_hash: `0x${string}`;
}

/** Successful response from POST /api/pago */
export interface PagoResponse {
  status: 'pagado';
  cuota_id: string;
  credito_id: string;
}

// =============================================================================
// Education API Types
// =============================================================================

/** Módulo educativo from GET /api/educacion/modulos */
export interface ApiModuloEducativo {
  id: string;
  orden: number;
  sender: 'system' | 'whatsapp_fld';
  mensaje: string;
  created_at: string;
}

/** Response from GET /api/educacion/modulos */
export interface ApiModulosResponse {
  modulos: ApiModuloEducativo[];
}

/** Progreso educativo from API */
export interface ApiEduProgreso {
  modulo_actual: number;
  completado: boolean;
  modulos_totales: number;
}

/** Response from GET /api/educacion/progreso */
export interface ApiEduProgresoResponse {
  progreso: ApiEduProgreso;
}

/** Response from POST /api/educacion/progreso */
export type ApiEduProgresoPostResponse = ApiEduProgresoResponse;

// =============================================================================
// App State
// =============================================================================

export interface AppState {
  // Wallet
  walletConnected: boolean;
  walletAddress: string | null;

  // Sesión / perfil mínimo (registered viene de profileCompleted del token)
  registered: boolean;
  municipio: Municipio;

  // GACC (sólo lo que consume la simulación de alerta de nodo)
  gaccMembers: Member[];

  // SIWE Auth
  authStep: AuthStep;
  siweMessage: string | null;
  siweSignature: `0x${string}` | null;
  authToken: string | null;
  refreshToken: string | null;

  // Alerts
  nodeAlert: boolean;
  alertPartnerName: string;

  // Blocking error modal
  errorModal: { title: string; message: string } | null;
}

// =============================================================================
// Default state
// =============================================================================

export function createDefaultState(): AppState {
  return {
    walletConnected: false,
    walletAddress: null,
    registered: false,
    municipio: 'guapi',
    gaccMembers: [],
    authStep: 'idle',
    siweMessage: null,
    siweSignature: null,
    authToken: null,
    refreshToken: null,
    nodeAlert: false,
    alertPartnerName: '',
    errorModal: null,
  };
}
