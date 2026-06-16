// =============================================================================
// LogoEvaluacion — Logo MANGLE con animación pulse suave
// Sin card redonda, logo grande directo con anillos concentricos
// =============================================================================
function LogoEvaluacion() {
  return (
    <div className="flex justify-center items-center py-4">
      <div className="relative flex items-center justify-center w-52 h-52">
        {/* Anillo exterior — pulse lento */}
        <div
          className="absolute w-52 h-52 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(91,140,90,0.10) 0%, transparent 70%)',
            animation: 'ping 2.8s cubic-bezier(0,0,0.2,1) infinite',
          }}
        />
        {/* Anillo medio */}
        <div
          className="absolute w-40 h-40 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(91,140,90,0.14) 0%, transparent 70%)',
            animation: 'pulse 2.2s ease-in-out infinite',
          }}
        />
        {/* Anillo interior */}
        <div
          className="absolute w-28 h-28 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(91,140,90,0.20) 0%, transparent 70%)',
            animation: 'pulse 1.9s ease-in-out infinite 0.4s',
          }}
        />
        {/* Logo — grande, sin card, con pulse suave */}
        <img
          src={logoMangle}
          alt="MANGLE"
          className="relative z-10 w-28 h-28 object-contain"
          style={{ animation: 'pulse 3s ease-in-out infinite' }}
        />
      </div>
    </div>
  );
}
