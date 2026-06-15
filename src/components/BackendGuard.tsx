// =============================================================================
// BackendGuard — overlay bloqueante cuando el backend no responde
// =============================================================================
//
// Gemelo de DisconnectGuard. Se suscribe al observer de api.ts (onNetworkError)
// y, cuando una request no alcanza el servidor (TypeError de fetch — server
// caído o inalcanzable), muestra un overlay a pantalla completa que bloquea la
// app hasta que el usuario reintente.
//
// "Reintentar" recarga la app: como AppState se persiste en localStorage, la
// sesión sobrevive y todos los fetch iniciales se vuelven a disparar limpios.
// Si el server sigue caído, el overlay reaparece en cuanto falle la 1ª petición.
// =============================================================================

import { useEffect, useState } from 'react';
import { onNetworkError, checkBackendStatus } from '../lib/api';

export default function BackendGuard({ children }: { children?: React.ReactNode }) {
  const [backendDown, setBackendDown] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // onNetworkError devuelve la función de desuscripción → cleanup directo.
    return onNetworkError(() => setBackendDown(true));
  }, []);

  const handleRetry = async () => {
    setIsChecking(true);
    const isUp = await checkBackendStatus();
    
    if (isUp) {
      // Si ya funciona, recargamos para rehidratar la app limpiamente
      window.location.reload();
    } else {
      // Si sigue caído, quitamos el loader para que pueda volver a intentar
      setIsChecking(false);
    }
  };

  if (!backendDown) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center mb-6 shadow-sm">
          <i className="fa-solid fa-plug-circle-xmark text-amber-500 text-5xl" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 text-center mb-3">
          Servidor no disponible
        </h2>
        <p className="text-base text-slate-500 text-center max-w-xs leading-relaxed">
          No pudimos conectar con el servidor. <br /> Lo sentimos, intentá de nuevo.
        </p>
      </div>

      {/* Action */}
      <div className="p-6 pb-8">
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 disabled:opacity-80 active:scale-[0.98] text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2"
        >
          <i className={`fa-solid fa-rotate-right ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Verificando...' : 'Reintentar'}
        </button>
      </div>
    </div>
  );
}
