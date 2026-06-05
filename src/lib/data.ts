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

export function getDefaultGaccMembers(municipio: string, selfName: string, selfScore: number): Member[] {
  if (municipio === 'guapi') {
    return [
      { name: selfName, role: 'Sabedora Ancestral', status: 'Al día', score: selfScore, self: true },
      { name: 'Yolanda Angulo', role: 'Conchera de Piangua', status: 'Al día', score: 94, self: false },
      { name: 'Lila Mercedes Mina', role: 'Artesana de Tetera', status: 'Al día', score: 95, self: false },
      { name: 'María Estela Cuero', role: 'Cocinera Tradicional', status: 'Al día', score: 90, self: false },
      { name: 'Dilma Solís', role: 'Cacaotera', status: 'Al día', score: 92, self: false },
    ];
  }
  return [
    { name: selfName, role: 'Emprendedora', status: 'Al día', score: selfScore, self: true },
    { name: 'Gladis Torres Ocoró', role: 'Dulces Tradicionales', status: 'Al día', score: 91, self: false },
    { name: 'Eufemia Banguera', role: 'Pescadora', status: 'Al día', score: 93, self: false },
    { name: 'Xiomara Carabalí', role: 'Cantadora', status: 'Al día', score: 89, self: false },
    { name: 'Luz Marina Caicedo', role: 'Sabedora de Azoteas', status: 'Al día', score: 96, self: false },
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
