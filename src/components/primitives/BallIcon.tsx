interface BallIconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function BallIcon({ size = 24, className, strokeWidth = 1.75 }: BallIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 L14.5 8 L19 9 M21 12 L17 14 L19 19 M3 12 L7 14 L5 19 M12 3 L9.5 8 L5 9 M14.5 8 L12 12 L9.5 8 M17 14 L12 12 L7 14" />
    </svg>
  );
}
