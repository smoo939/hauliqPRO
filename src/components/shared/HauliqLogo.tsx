import logoUrl from '@/assets/hauliq-logo.png';

interface HauliqLogoProps {
  /** Visual variant: 'dark' (black logo for light backgrounds) or 'light' (white logo for orange/dark backgrounds). */
  variant?: 'dark' | 'light';
  /** Pixel size of the logo image itself (the wrapper handles padding). */
  size?: number;
  className?: string;
}

export default function HauliqLogo({ variant = 'dark', size = 28, className = '' }: HauliqLogoProps) {
  const isLight = variant === 'light';
  return (
    <img
      src={logoUrl}
      alt="Hauliq"
      width={size}
      height={size}
      draggable={false}
      className={`select-none object-contain ${className}`}
      style={{
        width: size,
        height: size,
        filter: isLight ? 'brightness(0) invert(1)' : 'none',
      }}
    />
  );
}
