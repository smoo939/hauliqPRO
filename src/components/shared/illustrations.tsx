import React from 'react';

/**
 * Big isometric orange 3D box (used as the feature box on the right of cards).
 * Sized via parent container — pass width/height via className.
 */
export function BoxIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="boxTop" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD18A" />
          <stop offset="100%" stopColor="#FFB163" />
        </linearGradient>
        <linearGradient id="boxLeft" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF8A2B" />
          <stop offset="100%" stopColor="#F26A00" />
        </linearGradient>
        <linearGradient id="boxRight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E25E00" />
          <stop offset="100%" stopColor="#B84800" />
        </linearGradient>
        <filter id="boxShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" />
          <feOffset dx="0" dy="3" result="offsetblur" />
          <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#boxShadow)">
        {/* Top face */}
        <polygon points="10,32 50,12 90,32 50,52" fill="url(#boxTop)" />
        {/* Left face */}
        <polygon points="10,32 50,52 50,92 10,72" fill="url(#boxLeft)" />
        {/* Right face */}
        <polygon points="90,32 50,52 50,92 90,72" fill="url(#boxRight)" />
        {/* Tape on top */}
        <polygon points="30,42 70,22 70,28 30,48" fill="#9C3D00" opacity="0.18" />
        {/* Tape down the front seam */}
        <polygon points="48,52 52,52 52,92 48,92" fill="#9C3D00" opacity="0.16" />
        {/* Highlight edges */}
        <polyline points="10,32 50,12 90,32" fill="none" stroke="#FFE3BD" strokeWidth="0.6" opacity="0.55" />
        <line x1="50" y1="52" x2="50" y2="92" stroke="#7C2C00" strokeWidth="0.6" opacity="0.35" />
      </g>
    </svg>
  );
}

/**
 * Tiny isometric box icon used as a card thumbnail.
 */
export function MiniBoxIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mTop" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD18A" />
          <stop offset="100%" stopColor="#FFB163" />
        </linearGradient>
        <linearGradient id="mLeft" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF8A2B" />
          <stop offset="100%" stopColor="#F26A00" />
        </linearGradient>
        <linearGradient id="mRight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E25E00" />
          <stop offset="100%" stopColor="#B84800" />
        </linearGradient>
      </defs>
      <polygon points="3,8.5 12,4 21,8.5 12,13" fill="url(#mTop)" />
      <polygon points="3,8.5 12,13 12,21 3,16.5" fill="url(#mLeft)" />
      <polygon points="21,8.5 12,13 12,21 21,16.5" fill="url(#mRight)" />
      <polygon points="7,10.7 17,5.7 17,6.7 7,11.7" fill="#9C3D00" opacity="0.18" />
      <line x1="12" y1="13" x2="12" y2="21" stroke="#7C2C00" strokeWidth="0.4" opacity="0.45" />
    </svg>
  );
}

/**
 * Tiny side-view truck illustration used inside the dotted progress line.
 * Adapts to currentColor + filled body, tinted by parent (white on amber).
 */
export function MiniTruckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 18" className={className} aria-hidden="true">
      {/* Cargo body */}
      <rect x="1" y="3" width="14" height="10" rx="1.2" fill="currentColor" />
      {/* Cab */}
      <path d="M15 6 L19 6 L22 9 L22 13 L15 13 Z" fill="currentColor" />
      {/* Window */}
      <rect x="16.2" y="7.2" width="3.4" height="2.4" rx="0.4" fill="white" opacity="0.55" />
      {/* Wheels */}
      <circle cx="6" cy="14.5" r="2.4" fill="currentColor" />
      <circle cx="6" cy="14.5" r="1" fill="white" opacity="0.6" />
      <circle cx="18" cy="14.5" r="2.4" fill="currentColor" />
      <circle cx="18" cy="14.5" r="1" fill="white" opacity="0.6" />
      {/* Subtle door line */}
      <line x1="11" y1="3" x2="11" y2="13" stroke="white" strokeWidth="0.5" opacity="0.35" />
    </svg>
  );
}
