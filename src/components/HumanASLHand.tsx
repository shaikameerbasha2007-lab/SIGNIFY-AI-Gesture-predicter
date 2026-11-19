import { useId } from 'react';

export type SkinToneId = 'light' | 'warm' | 'medium' | 'tan' | 'deep';

interface SkinPalette {
  id: SkinToneId;
  label: string;
  swatch: string;
  highlight: string;
  base: string;
  mid: string;
  shadow: string;
  deepShadow: string;
  stroke: string;
  crease: string;
  nail: string;
}

export const SKIN_TONES: SkinPalette[] = [
  {
    id: 'light',
    label: 'Light',
    swatch: '#f6d5be',
    highlight: '#fce6d6',
    base: '#f4ceb3',
    mid: '#e4b393',
    shadow: '#cc9473',
    deepShadow: '#b07757',
    stroke: '#8a583d',
    crease: '#a56e50',
    nail: '#fff3ec',
  },
  {
    id: 'warm',
    label: 'Warm Fair',
    swatch: '#eab993',
    highlight: '#f7cfb0',
    base: '#e9b68e',
    mid: '#d79b71',
    shadow: '#bc7d54',
    deepShadow: '#9e623d',
    stroke: '#754428',
    crease: '#915737',
    nail: '#fcece1',
  },
  {
    id: 'medium',
    label: 'Medium',
    swatch: '#d69c72',
    highlight: '#e5b088',
    base: '#d3976c',
    mid: '#be7f54',
    shadow: '#a2653d',
    deepShadow: '#854e2b',
    stroke: '#5e341b',
    crease: '#7a4526',
    nail: '#f5dfd0',
  },
  {
    id: 'tan',
    label: 'Golden Brown',
    swatch: '#b0744d',
    highlight: '#c48860',
    base: '#ae724a',
    mid: '#975c37',
    shadow: '#7c4727',
    deepShadow: '#62351b',
    stroke: '#442311',
    crease: '#5b3019',
    nail: '#e6c8b6',
  },
  {
    id: 'deep',
    label: 'Deep Brown',
    swatch: '#7d4d32',
    highlight: '#966143',
    base: '#7e4e33',
    mid: '#693d26',
    shadow: '#522e1c',
    deepShadow: '#3d2013',
    stroke: '#261209',
    crease: '#3a1f12',
    nail: '#cfb09e',
  },
];

interface HumanASLHandProps {
  letter: string;
  size?: number;
  skinTone?: SkinToneId;
  className?: string;
}

/**
 * Studio-illustrated realistic human hand component for all 26 ASL fingerspelling
 * letters (A-Z), featuring natural skin gradients, anatomical palm/knuckle creases,
 * fingernails, and accurate finger occlusion & orientation.
 */
export function HumanASLHand({
  letter,
  size = 120,
  skinTone = 'warm',
  className = '',
}: HumanASLHandProps) {
  const uid = useId().replace(/:/g, '');
  const key = letter.toUpperCase();
  const p = SKIN_TONES.find((t) => t.id === skinTone) ?? SKIN_TONES[1];

  const palmGrad = `palm-${uid}`;
  const fingerGrad = `finger-${uid}`;
  const shadowGrad = `shadow-${uid}`;
  const bgGlow = `bg-${uid}`;

  // Reusable realistic upright human finger
  const UprightFinger = ({
    x,
    yTop,
    yBase,
    w = 13.5,
    angle = 0,
    showNail = false,
    back = false,
  }: {
    x: number;
    yTop: number;
    yBase: number;
    w?: number;
    angle?: number;
    showNail?: boolean;
    back?: boolean;
  }) => {
    const h = yBase - yTop;
    const r = w / 2;
    const pipY = yTop + h * 0.36;
    const dipY = yTop + h * 0.68;
    return (
      <g transform={`rotate(${angle} ${x} ${yBase})`}>
        <rect
          x={x - r}
          y={yTop}
          width={w}
          height={h}
          rx={r}
          fill={back ? `url(#${shadowGrad})` : `url(#${fingerGrad})`}
          stroke={p.stroke}
          strokeWidth="1.25"
        />
        {/* Subtle knuckle creases */}
        <path
          d={`M ${x - r * 0.52} ${pipY} Q ${x} ${pipY + 1.5} ${x + r * 0.52} ${pipY}`}
          fill="none"
          stroke={p.crease}
          strokeWidth="0.95"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d={`M ${x - r * 0.45} ${dipY} Q ${x} ${dipY + 1.3} ${x + r * 0.45} ${dipY}`}
          fill="none"
          stroke={p.crease}
          strokeWidth="0.85"
          strokeLinecap="round"
          opacity="0.45"
        />
        {showNail && (
          <path
            d={`M ${x - r * 0.55} ${yTop + 6.5} Q ${x} ${yTop + 1.2} ${x + r * 0.55} ${yTop + 6.5} Q ${x} ${yTop + 8.5} ${x - r * 0.55} ${yTop + 6.5} Z`}
            fill={p.nail}
            stroke={p.crease}
            strokeWidth="0.55"
            opacity="0.92"
          />
        )}
      </g>
    );
  };

  // Reusable curled finger pad resting against palm (for fists & folded fingers)
  const CurledFinger = ({
    x,
    y,
    w = 14,
    h = 24,
    nailVisible = false,
  }: {
    x: number;
    y: number;
    w?: number;
    h?: number;
    nailVisible?: boolean;
  }) => (
    <g>
      <rect
        x={x - w / 2}
        y={y}
        width={w}
        height={h}
        rx={w * 0.46}
        fill={`url(#${fingerGrad})`}
        stroke={p.stroke}
        strokeWidth="1.25"
      />
      {/* Upper knuckle highlight fold */}
      <path
        d={`M ${x - w * 0.34} ${y + h * 0.46} Q ${x} ${y + h * 0.56} ${x + w * 0.34} ${y + h * 0.46}`}
        fill="none"
        stroke={p.crease}
        strokeWidth="1.05"
        strokeLinecap="round"
        opacity="0.65"
      />
      {nailVisible && (
        <ellipse
          cx={x}
          cy={y + h - 4.5}
          rx={w * 0.28}
          ry={2.8}
          fill={p.nail}
          opacity="0.85"
        />
      )}
    </g>
  );

  // Sculpted human wrist + palm base (front-facing right hand)
  const StandardPalm = ({ compact = false }: { compact?: boolean }) => (
    <g>
      {/* Wrist */}
      <path
        d="M 48 118 L 49 95 L 87 95 L 89 118 Z"
        fill={`url(#${shadowGrad})`}
        stroke={p.stroke}
        strokeWidth="1.25"
      />
      {/* Main Palm */}
      <path
        d={
          compact
            ? 'M 42 54 C 40 68 41 86 48 97 C 55 104 82 104 88 95 C 95 85 96 67 94 54 C 92 48 44 48 42 54 Z'
            : 'M 41 48 C 39 65 40 85 48 97 C 55 104 82 104 88 95 C 95 84 96 65 94 49 C 92 43 43 43 41 48 Z'
        }
        fill={`url(#${palmGrad})`}
        stroke={p.stroke}
        strokeWidth="1.3"
      />
      {/* Natural palm creases */}
      <path
        d="M 52 74 Q 68 68 86 73"
        fill="none"
        stroke={p.crease}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M 49 86 Q 60 76 64 62"
        fill="none"
        stroke={p.crease}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.42"
      />
    </g>
  );

  // Thumb tucked neatly across the center of the palm
  const ThumbTuckedAcross = ({ high = false }: { high?: boolean }) => (
    <g>
      <path
        d={
          high
            ? 'M 41 84 C 35 76 36 62 45 58 L 76 55 C 83 55 85 65 78 68 L 53 73 C 49 76 47 84 44 90 Z'
            : 'M 41 88 C 34 80 35 67 45 64 L 74 61 C 81 61 83 71 76 74 L 54 78 C 50 82 48 88 45 94 Z'
        }
        fill={`url(#${fingerGrad})`}
        stroke={p.stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d={high ? 'M 57 59 Q 59 64 57 69' : 'M 57 65 Q 59 70 57 75'}
        fill="none"
        stroke={p.crease}
        strokeWidth="0.95"
        strokeLinecap="round"
        opacity="0.55"
      />
    </g>
  );

  // Thumb wrapped firmly across the front of a closed fist (S, I, J)
  const ThumbWrappedFist = () => (
    <g>
      <path
        d="M 40 85 C 33 76 34 61 45 58 L 74 56 C 81 56 82 67 74 69 L 51 73 C 47 77 46 84 44 91 Z"
        fill={`url(#${fingerGrad})`}
        stroke={p.stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Thumb nail tip */}
      <ellipse cx="75.5" cy="62.2" rx="3.4" ry="4.1" fill={p.nail} opacity="0.88" />
      <path
        d="M 55 60 Q 57 64 55 69"
        fill="none"
        stroke={p.crease}
        strokeWidth="0.95"
        opacity="0.55"
      />
    </g>
  );

  // Thumb extended out horizontally to the left (L, Y)
  const ThumbExtendedOut = () => (
    <g>
      <path
        d="M 44 89 C 35 84 24 76 15 72 C 9 69 12 58 20 60 L 42 66 C 47 68 49 77 47 87 Z"
        fill={`url(#${fingerGrad})`}
        stroke={p.stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M 29 63 Q 27 69 29 74"
        fill="none"
        stroke={p.crease}
        strokeWidth="0.95"
        strokeLinecap="round"
        opacity="0.5"
      />
    </g>
  );

  const renderHandByLetter = () => {
    switch (key) {
      case 'A':
        return (
          <g>
            <StandardPalm compact />
            <CurledFinger x={49} y={46} w={13.5} h={28} />
            <CurledFinger x={62.5} y={44} w={13.5} h={30} />
            <CurledFinger x={76} y={46} w={13} h={28} />
            <CurledFinger x={88.5} y={50} w={12} h={24} />
            {/* Thumb resting upright along side of index */}
            <path
              d="M 43 92 C 35 84 32 70 33 50 C 33.5 41 43.5 41 44 50 L 45 78 C 46 84 46 90 43 92 Z"
              fill={`url(#${fingerGrad})`}
              stroke={p.stroke}
              strokeWidth="1.3"
            />
            <ellipse cx="38.5" cy="48.5" rx="3.2" ry="4.4" fill={p.nail} opacity="0.88" />
          </g>
        );

      case 'B':
        return (
          <g>
            <StandardPalm />
            <UprightFinger x={48} yTop={14} yBase={54} w={12.5} />
            <UprightFinger x={60.5} yTop={10} yBase={53} w={13} />
            <UprightFinger x={73} yTop={13} yBase={54} w={12.5} />
            <UprightFinger x={85} yTop={22} yBase={57} w={11.5} />
            <ThumbTuckedAcross />
          </g>
        );

      case 'C':
        return (
          <g>
            {/* Wrist and heel of palm in 3/4 side profile */}
            <path
              d="M 60 118 L 62 96 L 88 94 L 90 118 Z"
              fill={`url(#${shadowGrad})`}
              stroke={p.stroke}
              strokeWidth="1.25"
            />
            {/* Back fingers subtly peeking behind index arch */}
            <path
              d="M 88 52 C 88 30 70 18 48 21 C 37 22 31 28 29 34 C 28 38 35 41 41 37 C 48 32 62 31 73 39"
              fill={`url(#${shadowGrad})`}
              stroke={p.stroke}
              strokeWidth="1.2"
            />
            {/* Main sculpted palm + curved front index finger + opposing curved thumb */}
            <path
              d="M 62 98 C 46 97 34 90 27 81 C 23 75 30 68 37 72 C 44 76 52 79 62 78 C 72 77 77 69 77 57 C 77 43 68 34 55 34 C 46 34 40 38 36 44 C 31 49 23 44 26 36 C 32 25 44 20 59 21 C 80 22 93 36 93 58 C 93 77 86 92 76 97 C 71 99 66 99 62 98 Z"
              fill={`url(#${palmGrad})`}
              stroke={p.stroke}
              strokeWidth="1.35"
              strokeLinejoin="round"
            />
            {/* Inner palm shadow & knuckle creases */}
            <path
              d="M 79 44 C 83 52 83 65 78 74"
              fill="none"
              stroke={p.crease}
              strokeWidth="1.1"
              strokeLinecap="round"
              opacity="0.5"
            />
            <path
              d="M 48 26 Q 50 30 49 34"
              fill="none"
              stroke={p.crease}
              strokeWidth="0.95"
              opacity="0.55"
            />
            <path
              d="M 44 80 Q 46 85 45 89"
              fill="none"
              stroke={p.crease}
              strokeWidth="0.95"
              opacity="0.55"
            />
            {/* Fingernails on curved index & thumb tips */}
            <ellipse cx="30" cy="39" rx="3.4" ry="2.2" transform="rotate(-38 30 39)" fill={p.nail} opacity="0.88" />
            <ellipse cx="30.5" cy="76" rx="3.3" ry="2.1" transform="rotate(34 30.5 76)" fill={p.nail} opacity="0.88" />
          </g>
        );

      case 'D':
        return (
          <g>
            <StandardPalm />
            {/* Index finger pointing straight up */}
            <UprightFinger x={48} yTop={12} yBase={54} w={13} />
            {/* Curled ring and pinky in background */}
            <CurledFinger x={76} y={50} w={12.5} h={24} />
            <CurledFinger x={88} y={54} w={11.5} h={22} />
            {/* Middle finger curved forward to touch thumb forming O-loop */}
            <path
              d="M 62 49 C 69 49 74 58 70 69 C 67 76 58 77 53 72 C 50 68 53 60 60 61"
              fill={`url(#${fingerGrad})`}
              stroke={p.stroke}
              strokeWidth="1.3"
            />
            {/* Thumb curving up to pinch middle fingertip */}
            <path
              d="M 41 88 C 34 78 36 64 46 61 C 52 59 58 63 58 69 C 58 74 51 77 47 79 Z"
              fill={`url(#${fingerGrad})`}
              stroke={p.stroke}
              strokeWidth="1.3"
            />
          </g>
        );

      case 'E':
        return (
          <g>
            <StandardPalm compact />
            {/* Thumb tucked low horizontally */}
            <path
              d="M 43 91 C 38 84 40 73 49 72 L 80 71 C 86 71 86 81 79 82 L 53 84 Z"
              fill={`url(#${shadowGrad})`}
              stroke={p.stroke}
              strokeWidth="1.25"
            />
            {/* All four fingertips bent tightly down resting above thumb */}
            <CurledFinger x={49} y={40} w={13.5} h={31} nailVisible />
            <CurledFinger x={62.5} y={37} w={13.5} h={33} nailVisible />
            <CurledFinger x={76} y={40} w={13} h={31} nailVisible />
            <CurledFinger x={88.5} y={45} w={12} h={27} nailVisible />
          </g>
        );

      case 'F':
        return (
          <g>
            <StandardPalm />
            {/* Three upright fanned fingers: middle, ring, pinky */}
            <UprightFinger x={62} yTop={11} yBase={53} w={12.5} angle={-5} />
            <UprightFinger x={75} yTop={13} yBase={54} w={12.5} angle={5} />
            <UprightFinger x={87} yTop={22} yBase={58} w={11.5} angle={15} />
            {/* Index curved down to pinch thumb tip forming crisp circle */}
            <path
              d="M 49 52 C 47 40 35 39 32 51 C 30 58 36 64 43 62 C 48 61 50 56 49 52 Z"
              fill="none"
              stroke={p.base}
              strokeWidth="9.5"
              strokeLinecap="round"
            />
            <path
              d="M 49 52 C 47 40 35 39 32 51 C 30 58 36 64 43 62"
              fill="none"
              stroke={p.stroke}
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <path
              d="M 42 89 C 33 82 28 70 33 61 C 36 56 44 58 45 64 C 46 70 46 80 44 89 Z"
              fill={`url(#${fingerGrad})`}
              stroke={p.stroke}
              strokeWidth="1.3"
            />
          </g>
        );

      case 'G':
        return (
          <g>
            {/* Sideways hand pointing horizontally left */}
            <path
              d="M 118 56 L 92 56 C 85 48 72 46 58 49 L 58 84 C 72 88 86 86 94 78 L 118 78 Z"
              fill={`url(#${palmGrad})`}
              stroke={p.stroke}
              strokeWidth="1.3"
            />
            {/* Curled middle/ring/pinky stacked on lower palm */}
            <rect x="61" y="65" width="24" height="11" rx="5.5" fill={`url(#${shadowGrad})`} stroke={p.stroke} strokeWidth="1.2" />
            <rect x="63" y="75" width="22" height="10" rx="5" fill={`url(#${shadowGrad})`} stroke={p.stroke} strokeWidth="1.2" />
            {/* Index extended horizontally */}
            <rect x="16" y="45" width="54" height="12.5" rx="6.25" fill={`url(#${fingerGrad})`} stroke={p.stroke} strokeWidth="1.3" />
            <ellipse cx="21" cy="51.2" rx="4.2" ry="3.2" fill={p.nail} opacity="0.88" />
            {/* Thumb parallel directly below index */}
            <rect x="26" y="60" width="44" height="11.5" rx="5.75" fill={`url(#${fingerGrad})`} stroke={p.stroke} strokeWidth="1.3" />
          </g>
        );

      case 'H':
        return (
          <g>
            {/* Sideways hand with index & middle extended parallel */}
            <path
              d="M 118 55 L 92 55 C 85 47 72 45 58 48 L 58 85 C 72 89 86 87 94 79 L 118 79 Z"
              fill={`url(#${palmGrad})`}
              stroke={p.stroke}
              strokeWidth="1.3"
            />
            {/* Index & middle extended horizontally together */}
            <rect x="14" y="44" width="56" height="12" rx="6" fill={`url(#${fingerGrad})`} stroke={p.stroke} strokeWidth="1.3" />
            <rect x="16" y="56" width="54" height="12" rx="6" fill={`url(#${fingerGrad})`} stroke={p.stroke} strokeWidth="1.3" />
            {/* Curled ring & pinky tucked below */}
            <rect x="62" y="69" width="23" height="10" rx="5" fill={`url(#${shadowGrad})`} stroke={p.stroke} strokeWidth="1.2" />
            <rect x="65" y="78" width="20" height="9.5" rx="4.75" fill={`url(#${shadowGrad})`} stroke={p.stroke} strokeWidth="1.2" />
            {/* Thumb resting over curled ring */}
            <path
              d="M 88 73 L 62 70 C 56 70 55 78 62 79 L 86 81 Z"
              fill={`url(#${fingerGrad})`}
              stroke={p.stroke}
              strokeWidth="1.2"
            />
          </g>
        );

      case 'I':
        return (
          <g>
            <StandardPalm compact />
            <CurledFinger x={49} y={48} w={13.5} h={27} />
            <CurledFinger x={62.5} y={46} w={13.5} h={28} />
            <CurledFinger x={76} y={48} w={13} h={27} />
            {/* Pinky straight up */}
            <UprightFinger x={88.5} yTop={17} yBase={59} w={11.5} />
            <ThumbWrappedFist />
          </g>
        );

      case 'J':
        return (
          <g>
            {/* Dynamic J motion trail behind human hand */}
            <path
              d="M 103 24 L 103 68 C 103 82 88 86 78 78"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="2.8"
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
            <polygon points="73,74 82,74 78,83" fill="#a78bfa" />
            <StandardPalm compact />
            <CurledFinger x={49} y={48} w={13.5} h={27} />
            <CurledFinger x={62.5} y={46} w={13.5} h={28} />
            <CurledFinger x={76} y={48} w={13} h={27} />
            <UprightFinger x={88.5} yTop={17} yBase={59} w={11.5} angle={6} />
            <ThumbWrappedFist />
          </g>
        );

      case 'K':
        return (
          <g>
            <StandardPalm />
            {/* Index straight up, middle angled slightly right */}
            <UprightFinger x={48} yTop={12} yBase={54} w={13} angle={-5} />
            <UprightFinger x={65} yTop={14} yBase={54} w={13} angle={14} />
            <CurledFinger x={77} y={50} w={12.5} h={25} />
            <CurledFinger x={89} y={54} w={11.5} h={23} />
            {/* Thumb pressed upward squarely between index & middle */}
            <path
              d="M 42 88 C 38 76 44 58 54 44 C 58 38 66 43 62 50 L 52 74 C 49 82 47 87 42 88 Z"
              fill={`url(#${fingerGrad})`}
              stroke={p.stroke}
              strokeWidth="1.3"
            />
            <ellipse cx="57.5" cy="45.5" rx="3" ry="3.8" transform="rotate(24 57.5 45.5)" fill={p.nail} opacity="0.88" />
          </g>
        );

      case 'L':
        return (
          <g>
            <StandardPalm compact />
            <UprightFinger x={48} yTop={11} yBase={54} w={13} />
            <CurledFinger x={62.5} y={47} w={13.5} h={27} />
            <CurledFinger x={76} y={49} w={13} h={26} />
            <CurledFinger x={88.5} y={53} w={12} h={24} />
            <ThumbExtendedOut />
          </g>
        );

      case 'M':
        return (
          <g>
            <StandardPalm compact />
            {/* Thumb tucked underneath 3 fingers, tip peeking between ring & pinky */}
            <path
              d="M 44 84 L 79 66 C 85 63 89 71 83 75 L 54 88 Z"
              fill={`url(#${shadowGrad})`}
              stroke={p.stroke}
              strokeWidth="1.25"
            />
            <ellipse cx="82.5" cy="69.5" rx="4.5" ry="5" fill={`url(#${fingerGrad})`} stroke={p.stroke} strokeWidth="1.2" />
            {/* Three fingers folded prominently forward over tucked thumb */}
            <CurledFinger x={49} y={42} w={13.5} h={34} />
            <CurledFinger x={62.5} y={40} w={13.5} h={36} />
            <CurledFinger x={75.5} y={43} w={13} h={34} />
            <CurledFinger x={89} y={52} w={11.5} h={23} />
          </g>
        );

      case 'N':
        return (
          <g>
            <StandardPalm compact />
            {/* Thumb tucked underneath 2 fingers, peeking between middle & ring */}
            <path
              d="M 44 84 L 68 65 C 74 62 78 70 72 74 L 54 87 Z"
              fill={`url(#${shadowGrad})`}
              stroke={p.stroke}
              strokeWidth="1.25"
            />
            <ellipse cx="70" cy="68.5" rx="4.6" ry="5.2" fill={`url(#${fingerGrad})`} stroke={p.stroke} strokeWidth="1.2" />
            {/* Two fingers (index & middle) folded forward over tucked thumb */}
            <CurledFinger x={49} y={42} w={13.5} h={34} />
            <CurledFinger x={62.5} y={40} w={13.5} h={36} />
            <CurledFinger x={77} y={50} w={12.5} h={24} />
            <CurledFinger x={89} y={54} w={11.5} h={22} />
          </g>
        );

      case 'O':
        return (
          <g>
            {/* Wrist base */}
            <path
              d="M 56 118 L 58 94 L 86 94 L 88 118 Z"
              fill={`url(#${shadowGrad})`}
              stroke={p.stroke}
              strokeWidth="1.25"
            />
            {/* Back curved fingers stacked neatly behind index */}
            <path
              d="M 88 55 C 88 32 72 20 51 22 C 36 24 28 36 28 50 L 42 52 C 43 40 50 34 61 34 C 72 34 78 44 78 58"
              fill={`url(#${shadowGrad})`}
              stroke={p.stroke}
              strokeWidth="1.2"
            />
            {/* Main sculpted palm + upper curved index touching lower curved thumb */}
            <path
              d="M 58 96 C 42 93 30 79 29 61 C 28 40 41 24 61 24 C 81 24 94 38 94 60 C 94 79 86 93 74 97 C 68 98 62 98 58 96 Z"
              fill={`url(#${palmGrad})`}
              stroke={p.stroke}
              strokeWidth="1.35"
            />
            {/* Natural teardrop/oval aperture inside the pinched O */}
            <path
              d="M 44 57 C 44 43 52 36 62 37 C 71 38 76 47 76 59 C 76 70 69 78 59 78 C 49 78 44 69 44 57 Z"
              fill="#070e20"
              stroke={p.stroke}
              strokeWidth="1.3"
            />
            {/* Seam where fingertips pinch thumb tip */}
            <path d="M 30 58 Q 37 56 44 58" fill="none" stroke={p.stroke} strokeWidth="1.35" strokeLinecap="round" />
            {/* Knuckle & palm depth creases */}
            <path d="M 48 29 Q 51 33 50 37" fill="none" stroke={p.crease} strokeWidth="0.95" opacity="0.55" />
            <path d="M 45 78 Q 47 83 45 87" fill="none" stroke={p.crease} strokeWidth="0.95" opacity="0.55" />
            <ellipse cx="34.5" cy="52.5" rx="3.1" ry="2.1" transform="rotate(-18 34.5 52.5)" fill={p.nail} opacity="0.85" />
          </g>
        );

      case 'P':
        return (
          <g transform="rotate(148 66 64)">
            <StandardPalm />
            <UprightFinger x={48} yTop={14} yBase={54} w={13} angle={-5} />
            <UprightFinger x={65} yTop={16} yBase={54} w={13} angle={14} />
            <CurledFinger x={77} y={50} w={12.5} h={25} />
            <CurledFinger x={89} y={54} w={11.5} h={23} />
            <path
              d="M 42 88 C 38 76 44 58 54 44 C 58 38 66 43 62 50 L 52 74 Z"
              fill={`url(#${fingerGrad})`}
              stroke={p.stroke}
              strokeWidth="1.3"
            />
          </g>
        );

      case 'Q':
        return (
          <g transform="rotate(-90 66 64)">
            <path
              d="M 118 56 L 92 56 C 85 48 72 46 58 49 L 58 84 C 72 88 86 86 94 78 L 118 78 Z"
              fill={`url(#${palmGrad})`}
              stroke={p.stroke}
              strokeWidth="1.3"
            />
            <rect x="61" y="65" width="24" height="11" rx="5.5" fill={`url(#${shadowGrad})`} stroke={p.stroke} strokeWidth="1.2" />
            <rect x="63" y="75" width="22" height="10" rx="5" fill={`url(#${shadowGrad})`} stroke={p.stroke} strokeWidth="1.2" />
            <rect x="16" y="45" width="54" height="12.5" rx="6.25" fill={`url(#${fingerGrad})`} stroke={p.stroke} strokeWidth="1.3" />
            <rect x="26" y="60" width="44" height="11.5" rx="5.75" fill={`url(#${fingerGrad})`} stroke={p.stroke} strokeWidth="1.3" />
          </g>
        );

      case 'R':
        return (
          <g>
            <StandardPalm />
            {/* Middle finger crossing behind index */}
            <UprightFinger x={59} yTop={11} yBase={54} w={12.5} angle={-14} back />
            {/* Index finger crossing in front of middle */}
            <UprightFinger x={51} yTop={13} yBase={54} w={12.5} angle={11} />
            <CurledFinger x={76} y={49} w={13} h={25} />
            <CurledFinger x={88.5} y={53} w={12} h={23} />
            <ThumbTuckedAcross />
          </g>
        );

      case 'S':
        return (
          <g>
            <StandardPalm compact />
            <CurledFinger x={49} y={46} w={13.5} h={28} />
            <CurledFinger x={62.5} y={44} w={13.5} h={29} />
            <CurledFinger x={76} y={46} w={13} h={28} />
            <CurledFinger x={88.5} y={50} w={12} h={24} />
            <ThumbWrappedFist />
          </g>
        );

      case 'T':
        return (
          <g>
            <StandardPalm compact />
            <CurledFinger x={62.5} y={45} w={13.5} h={29} />
            <CurledFinger x={76} y={47} w={13} h={28} />
            <CurledFinger x={88.5} y={51} w={12} h={24} />
            {/* Thumb tucked upward peeking cleanly between index and middle */}
            <path
              d="M 43 89 C 40 76 46 58 53 45 C 56 39 64 43 62 50 L 54 78 Z"
              fill={`url(#${fingerGrad})`}
              stroke={p.stroke}
              strokeWidth="1.3"
            />
            <ellipse cx="56.5" cy="46.5" rx="3.1" ry="3.8" fill={p.nail} opacity="0.9" />
            {/* Index finger folded in front of thumb base */}
            <CurledFinger x={48} y={46} w={13.5} h={29} />
          </g>
        );

      case 'U':
        return (
          <g>
            <StandardPalm />
            {/* Index & middle straight up, pressed tightly together */}
            <UprightFinger x={50} yTop={11} yBase={54} w={13} />
            <UprightFinger x={63} yTop={10} yBase={53} w={13} />
            <CurledFinger x={76.5} y={49} w={13} h={25} />
            <CurledFinger x={88.5} y={53} w={12} h={23} />
            <ThumbTuckedAcross />
          </g>
        );

      case 'V':
        return (
          <g>
            <StandardPalm />
            {/* Index & middle spread apart in clear V */}
            <UprightFinger x={47} yTop={12} yBase={54} w={13} angle={-15} />
            <UprightFinger x={65} yTop={11} yBase={54} w={13} angle={15} />
            <CurledFinger x={77} y={49} w={12.5} h={25} />
            <CurledFinger x={89} y={53} w={11.5} h={23} />
            <ThumbTuckedAcross />
          </g>
        );

      case 'W':
        return (
          <g>
            <StandardPalm />
            {/* Three fingers fanned cleanly upright */}
            <UprightFinger x={47} yTop={13} yBase={54} w={12.5} angle={-15} />
            <UprightFinger x={62} yTop={10} yBase={53} w={12.5} angle={0} />
            <UprightFinger x={76} yTop={13} yBase={54} w={12.5} angle={14} />
            <CurledFinger x={89} y={53} w={11.5} h={23} />
            <ThumbTuckedAcross />
          </g>
        );

      case 'X':
        return (
          <g>
            <StandardPalm compact />
            {/* Hooked index finger */}
            <path
              d="M 48 56 L 48 31 C 48 21 63 20 65 30 C 66 36 60 40 56 38"
              fill="none"
              stroke={p.stroke}
              strokeWidth="13.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 48 56 L 48 31 C 48 21 63 20 65 30 C 66 36 60 40 56 38"
              fill="none"
              stroke={`url(#${fingerGrad})`}
              strokeWidth="10.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <CurledFinger x={63} y={47} w={13.5} h={27} />
            <CurledFinger x={76.5} y={49} w={13} h={26} />
            <CurledFinger x={88.5} y={53} w={12} h={24} />
            <ThumbTuckedAcross />
          </g>
        );

      case 'Y':
        return (
          <g>
            <StandardPalm compact />
            <CurledFinger x={49} y={48} w={13.5} h={27} />
            <CurledFinger x={62.5} y={46} w={13.5} h={28} />
            <CurledFinger x={76} y={48} w={13} h={27} />
            {/* Pinky angled out right */}
            <UprightFinger x={89} yTop={19} yBase={59} w={11.5} angle={22} />
            {/* Thumb extended out left */}
            <ThumbExtendedOut />
          </g>
        );

      case 'Z':
        return (
          <g>
            {/* Dynamic Z zigzag path above pointing index */}
            <path
              d="M 18 14 L 58 14 L 22 40 L 62 40"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2.6"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polygon points="67,40 59,36 59,44" fill="#22d3ee" />
            <StandardPalm compact />
            <UprightFinger x={48} yTop={16} yBase={54} w={13} angle={-8} />
            <CurledFinger x={63} y={48} w={13.5} h={26} />
            <CurledFinger x={76.5} y={50} w={13} h={25} />
            <CurledFinger x={88.5} y={54} w={11.5} h={23} />
            <ThumbTuckedAcross />
          </g>
        );

      default:
        return (
          <g>
            <StandardPalm />
            <UprightFinger x={48} yTop={14} yBase={54} w={12.5} />
            <UprightFinger x={60.5} yTop={10} yBase={53} w={13} />
            <UprightFinger x={73} yTop={13} yBase={54} w={12.5} />
            <UprightFinger x={85} yTop={22} yBase={57} w={11.5} />
            <ThumbExtendedOut />
          </g>
        );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 124"
      className={className}
      role="img"
      aria-label={`Human hand gesture showing ASL letter ${key}`}
    >
      <defs>
        <radialGradient id={bgGlow} cx="50%" cy="48%" r="52%">
          <stop offset="0%" stopColor="rgba(56, 189, 248, 0.12)" />
          <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
        </radialGradient>
        <linearGradient id={palmGrad} x1="15%" y1="10%" x2="88%" y2="95%">
          <stop offset="0%" stopColor={p.highlight} />
          <stop offset="48%" stopColor={p.base} />
          <stop offset="85%" stopColor={p.mid} />
          <stop offset="100%" stopColor={p.shadow} />
        </linearGradient>
        <linearGradient id={fingerGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.highlight} />
          <stop offset="52%" stopColor={p.base} />
          <stop offset="100%" stopColor={p.shadow} />
        </linearGradient>
        <linearGradient id={shadowGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.mid} />
          <stop offset="100%" stopColor={p.deepShadow} />
        </linearGradient>
      </defs>

      <circle cx="64" cy="62" r="56" fill={`url(#${bgGlow})`} />
      {renderHandByLetter()}
    </svg>
  );
}
