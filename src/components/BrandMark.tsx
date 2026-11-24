interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = 'w-7 h-7' }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 11L18 25L27 11" stroke="#9E6B3B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 11L18 18L22.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="8" y1="28.5" x2="28" y2="28.5" stroke="#9E6B3B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
