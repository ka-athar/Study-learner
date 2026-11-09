import React from 'react';

interface SBBMCrestProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  className?: string;
  variant?: 'gold' | 'monochrome' | 'badge';
}

export const SBBMCrest: React.FC<SBBMCrestProps> = ({
  size = 'md',
  showLabel = true,
  className = '',
  variant = 'gold'
}) => {
  const dimension = size === 'sm' ? 36 : size === 'md' ? 48 : size === 'lg' ? 68 : 88;
  const isPrint = variant === 'monochrome';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Heraldic Circular Crest SVG */}
      <div 
        className="relative flex items-center justify-center shrink-0 drop-shadow-sm transition-transform hover:scale-105"
        style={{ width: dimension, height: dimension }}
      >
        <svg 
          viewBox="0 0 120 120" 
          width={dimension} 
          height={dimension} 
          className="w-full h-full overflow-visible"
        >
          <defs>
            {/* Outer Ring Gold Gradient */}
            <linearGradient id="sbbmGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="35%" stopColor="#D97706" />
              <stop offset="70%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#92400E" />
            </linearGradient>

            {/* Inner Shield Gradient */}
            <linearGradient id="sbbmShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E1B4B" />
              <stop offset="50%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>

            {/* Laurel Leaf Color */}
            <linearGradient id="sbbmLaurelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>

            {/* Circular Path for Text */}
            <path
              id="sbbmTopTextPath"
              d="M 22 60 A 38 38 0 0 1 98 60"
              fill="none"
            />
            <path
              id="sbbmBottomTextPath"
              d="M 98 60 A 38 38 0 0 1 22 60"
              fill="none"
            />
          </defs>

          {/* Outer Scalloped / Starburst Authority Ring */}
          <circle
            cx="60"
            cy="60"
            r="56"
            fill={isPrint ? '#FFFFFF' : 'url(#sbbmGoldGrad)'}
            stroke={isPrint ? '#000000' : '#B45309'}
            strokeWidth="2"
          />

          {/* Concentric Golden Inset Ring */}
          <circle
            cx="60"
            cy="60"
            r="51"
            fill={isPrint ? '#F8F9FA' : '#1E1B4B'}
            stroke={isPrint ? '#333333' : '#FBBF24'}
            strokeWidth="1.8"
            strokeDasharray={isPrint ? 'none' : '3, 2'}
          />

          {/* Circular Text: SINDH BOARD OF SECONDARY & HIGHER EDUCATION */}
          {!isPrint && (
            <text fontSize="7" fontWeight="bold" letterSpacing="1.2" fill="#FDE68A" className="font-mono">
              <textPath href="#sbbmTopTextPath" startOffset="50%" textAnchor="middle">
                SINDH BOARD OF EDUCATION
              </textPath>
            </text>
          )}

          {/* Central Shield Container */}
          <circle
            cx="60"
            cy="60"
            r="38"
            fill={isPrint ? '#FFFFFF' : 'url(#sbbmShieldGrad)'}
            stroke={isPrint ? '#000000' : '#F59E0B'}
            strokeWidth="2"
          />

          {/* Heraldic Laurel Wreath Left */}
          <g fill={isPrint ? '#333333' : 'url(#sbbmLaurelGrad)'}>
            <ellipse cx="32" cy="52" rx="3" ry="1.5" transform="rotate(-30 32 52)" />
            <ellipse cx="30" cy="59" rx="3.2" ry="1.6" transform="rotate(-15 30 59)" />
            <ellipse cx="31" cy="67" rx="3.2" ry="1.6" transform="rotate(15 31 67)" />
            <ellipse cx="34" cy="74" rx="3" ry="1.5" transform="rotate(35 34 74)" />
            <ellipse cx="39" cy="80" rx="2.8" ry="1.4" transform="rotate(50 39 80)" />
          </g>

          {/* Heraldic Laurel Wreath Right */}
          <g fill={isPrint ? '#333333' : 'url(#sbbmLaurelGrad)'}>
            <ellipse cx="88" cy="52" rx="3" ry="1.5" transform="rotate(30 88 52)" />
            <ellipse cx="90" cy="59" rx="3.2" ry="1.6" transform="rotate(15 90 59)" />
            <ellipse cx="89" cy="67" rx="3.2" ry="1.6" transform="rotate(-15 89 67)" />
            <ellipse cx="86" cy="74" rx="3" ry="1.5" transform="rotate(-35 86 74)" />
            <ellipse cx="81" cy="80" rx="2.8" ry="1.4" transform="rotate(-50 81 80)" />
          </g>

          {/* Central Shield Graphic: Open Academic Book & Torch of Knowledge */}
          <g transform="translate(60, 56) scale(0.9)">
            {/* Open Book Pages */}
            <path
              d="M -16 6 Q -8 0 0 4 Q 8 0 16 6 L 15 15 Q 8 9 0 12 Q -8 9 -15 15 Z"
              fill={isPrint ? '#E2E8F0' : '#FFFFFF'}
              stroke={isPrint ? '#000000' : '#D97706'}
              strokeWidth="1.2"
            />
            {/* Spine */}
            <line x1="0" y1="4" x2="0" y2="12" stroke={isPrint ? '#000000' : '#92400E'} strokeWidth="1.5" />
            {/* Page Lines */}
            <line x1="-12" y1="9" x2="-4" y2="7" stroke={isPrint ? '#666666' : '#94A3B8'} strokeWidth="0.8" />
            <line x1="4" y1="7" x2="12" y2="9" stroke={isPrint ? '#666666' : '#94A3B8'} strokeWidth="0.8" />

            {/* Flaming Torch of Excellence above Book */}
            <path
              d="M -3 1 L 3 1 L 1.5 -7 L -1.5 -7 Z"
              fill={isPrint ? '#333333' : '#F59E0B'}
              stroke={isPrint ? '#000000' : '#78350F'}
              strokeWidth="0.8"
            />
            {/* Flame */}
            <path
              d="M 0 -8 Q -4 -13 0 -18 Q 4 -13 0 -8 Z"
              fill={isPrint ? '#000000' : '#EF4444'}
            />
            <path
              d="M 0 -9 Q -2 -12 0 -15 Q 2 -12 0 -9 Z"
              fill={isPrint ? '#FFFFFF' : '#FDE047'}
            />
          </g>

          {/* SBBM Prominent Monogram Ribbon */}
          <rect
            x="34"
            y="75"
            width="52"
            height="15"
            rx="4"
            fill={isPrint ? '#FFFFFF' : '#B45309'}
            stroke={isPrint ? '#000000' : '#FDE68A'}
            strokeWidth="1.2"
          />
          <text
            x="60"
            y="86"
            textAnchor="middle"
            fontSize="10"
            fontWeight="900"
            fontFamily="serif"
            letterSpacing="1.5"
            fill={isPrint ? '#000000' : '#FEF3C7'}
          >
            SBBM
          </text>

          {/* Bottom Star Cluster */}
          <polygon
            points="60,94 61.5,98 65.5,98.5 62.5,101 63.5,105 60,102.5 56.5,105 57.5,101 54.5,98.5 58.5,98"
            fill={isPrint ? '#000000' : '#F59E0B'}
          />
          <circle cx="50" cy="98" r="1.5" fill={isPrint ? '#000000' : '#FDE68A'} />
          <circle cx="70" cy="98" r="1.5" fill={isPrint ? '#000000' : '#FDE68A'} />
        </svg>
      </div>

      {/* Brand Text Block */}
      {showLabel && (
        <div className="flex flex-col justify-center leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-serif font-black tracking-tight text-primary text-sm sm:text-base">
              SBBM Board
            </span>
            <span className="text-[9px] font-mono font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
              Verified
            </span>
          </div>
          <span className="text-[10px] text-muted font-medium">
            Official Academic Exam Board
          </span>
        </div>
      )}
    </div>
  );
};
