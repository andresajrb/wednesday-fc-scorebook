interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Emblema WFC. Es la marca de la app — distinto de `BallIcon`, que es el icono
 * de dominio para goles y partidas. Hereda el color con `currentColor`.
 */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Miércoles de Fútbol"
    >
      <circle
        cx="256"
        cy="256"
        r="226"
        fill="none"
        stroke="currentColor"
        strokeWidth="26"
        strokeDasharray="206.65 30"
        transform="rotate(-26.2 256 256)"
      />
      <g transform="translate(256,256) scale(0.76) translate(-283.9,-256)">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="42.1"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        >
          <path d="M95 181 L128 315 L158 225 L188 315 L221 181" />
          <path d="M269 331 L269 181 L333 181" />
          <path d="M269 256 L321 256" />
          <path d="M472.85 303.49 A 62 62 0 1 1 472.85 208.51" />
        </g>
      </g>
    </svg>
  );
}
