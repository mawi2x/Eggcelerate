// Cheerful cracked-egg chick mascot, used sparingly (empty states + brand accent).

interface MascotProps {
  size?: number;
  className?: string;
}

export function Mascot({ size = 120, className }: MascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      role="img"
      aria-label="Eggcelerate chick mascot"
    >
      {/* Lower egg shell */}
      <path
        d="M28 74c0 18 14 30 32 30s32-12 32-30c0-4-1-8-2-11l-60 0c-1 3-2 7-2 11z"
        fill="#EFE1B7"
        stroke="#AD3A1D"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Crack edge */}
      <path
        d="M28 63l8 6 7-8 7 9 7-9 8 9 7-9 7 8 8-6"
        fill="#EFE1B7"
        stroke="#AD3A1D"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Chick head */}
      <circle cx="60" cy="42" r="24" fill="#D8BE65" stroke="#AD3A1D" strokeWidth="3" />
      {/* Beak */}
      <path d="M60 44l-9 5 9 5 9-5-9-5z" fill="#CB6036" stroke="#AD3A1D" strokeWidth="2" strokeLinejoin="round" />
      {/* Goggle eyes */}
      <circle cx="51" cy="38" r="7" fill="#FFFFFF" stroke="#AD3A1D" strokeWidth="2.5" />
      <circle cx="69" cy="38" r="7" fill="#FFFFFF" stroke="#AD3A1D" strokeWidth="2.5" />
      <circle cx="52.5" cy="39.5" r="2.6" fill="#2D1A0E" />
      <circle cx="70.5" cy="39.5" r="2.6" fill="#2D1A0E" />
      <circle cx="54" cy="37" r="0.9" fill="#FFFFFF" />
      <circle cx="72" cy="37" r="0.9" fill="#FFFFFF" />
      {/* Little tuft */}
      <path d="M60 18c-2-6 2-10 2-10s4 5 1 10" fill="#CB6036" stroke="#AD3A1D" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
