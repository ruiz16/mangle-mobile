// =============================================================================
// Mangle — Mock Data
// =============================================================================

import type { Member, EduStep } from '../types';

// ---------------------------------------------------------------------------
// Referidoras by GACC
// ---------------------------------------------------------------------------

export const REFERIDORAS_BY_GACC: Record<string, string[]> = {
  guapi: [
    'Yolanda Angulo (Conchera)',
    'Lila Mercedes Mina (Artesana)',
    'María Estela Cuero (Cocinera)',
  ],
  timbiqui: [
    'Gladis Torres Ocoró (Dulces)',
    'Eufemia Banguera (Pescadora)',
    'Xiomara Carabalí (Cantadora)',
  ],
};

// ---------------------------------------------------------------------------
// GACC Members (simulated)
// ---------------------------------------------------------------------------

let memberIdCounter = 0;

function nextMemberId(): string {
  memberIdCounter++;
  return `mock-miembro-${memberIdCounter}`;
}

export function getDefaultGaccMembers(municipio: string, selfName: string, selfScore: number): Member[] {
  const selfId = nextMemberId();
  if (municipio === 'guapi') {
    return [
      { id: selfId, participanteId: `mock-part-${selfId}`, name: selfName, role: 'Sabedora Ancestral', status: 'Al día', score: selfScore, validado: true, self: true },
      { id: nextMemberId(), participanteId: 'mock-part-yolanda', name: 'Yolanda Angulo', role: 'Conchera de Piangua', status: 'Al día', score: 94, validado: true, self: false },
      { id: nextMemberId(), participanteId: 'mock-part-lila', name: 'Lila Mercedes Mina', role: 'Artesana de Tetera', status: 'Al día', score: 95, validado: true, self: false },
      { id: nextMemberId(), participanteId: 'mock-part-maria', name: 'María Estela Cuero', role: 'Cocinera Tradicional', status: 'Al día', score: 90, validado: true, self: false },
      { id: nextMemberId(), participanteId: 'mock-part-dilma', name: 'Dilma Solís', role: 'Cacaotera', status: 'Al día', score: 92, validado: true, self: false },
    ];
  }
  return [
    { id: selfId, participanteId: `mock-part-${selfId}`, name: selfName, role: 'Emprendedora', status: 'Al día', score: selfScore, validado: true, self: true },
    { id: nextMemberId(), participanteId: 'mock-part-gladis', name: 'Gladis Torres Ocoró', role: 'Dulces Tradicionales', status: 'Al día', score: 91, validado: true, self: false },
    { id: nextMemberId(), participanteId: 'mock-part-eufemia', name: 'Eufemia Banguera', role: 'Pescadora', status: 'Al día', score: 93, validado: true, self: false },
    { id: nextMemberId(), participanteId: 'mock-part-xiomara', name: 'Xiomara Carabalí', role: 'Cantadora', status: 'Al día', score: 89, validado: true, self: false },
    { id: nextMemberId(), participanteId: 'mock-part-luz', name: 'Luz Marina Caicedo', role: 'Sabedora de Azoteas', status: 'Al día', score: 96, validado: true, self: false },
  ];
}

// ---------------------------------------------------------------------------
// Education chat conversation
// ---------------------------------------------------------------------------

export const EDU_CONVERSATION: EduStep[] = [
  {
    sender: 'system',
    msg: 'Has iniciado tu proceso formativo. ¡Bienvenida a tu camino de autonomía!',
    time: '10:09 AM',
  },
  {
    sender: 'whatsapp_fld',
    msg: '🍃 **Lección 1:** El GACC es un fondo común. Si una persona del grupo presenta dificultad, las demás brindamos apoyo. No hay cobradores externos, nos respaldamos entre nosotras.',
    time: '10:10 AM',
  },
  {
    sender: 'whatsapp_fld',
    msg: '💡 **Lección 2:** El pago oportuno mejora tu *Score de Confianza* (Credencial NFT), permitiendo que todo tu grupo acceda a montos más altos en el siguiente ciclo.',
    time: '10:11 AM',
  },
  {
    sender: 'whatsapp_fld',
    msg: '¡Felicidades! Has completado el módulo. Ahora estás lista para ingresar el monto del microcrédito que necesitas para tu negocio.',
    time: '10:12 AM',
  },
];
