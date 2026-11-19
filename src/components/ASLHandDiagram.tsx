import { useMemo } from 'react';
import { generateDemoHandLandmarks } from '../ml/demoHandPoses';
import { HAND_CONNECTIONS } from '../ml/handCanvasRenderer';

interface ASLHandDiagramProps {
  letter: string;
  size?: number;
  className?: string;
}

const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

/**
 * Renders a crisp 21-landmark SVG anatomical diagram for any ASL letter A-Z,
 * generated directly from the classifier's 3D hand landmark geometry.
 */
export function ASLHandDiagram({ letter, size = 120, className = '' }: ASLHandDiagramProps) {
  const { points, isDynamic } = useMemo(() => {
    const raw = generateDemoHandLandmarks(letter, { centerX: 0.5, centerY: 0.76, scale: 0.26 });

    // Auto-fit landmarks neatly into SVG viewBox [14..86] with padding
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of raw) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const spanX = Math.max(maxX - minX, 0.12);
    const spanY = Math.max(maxY - minY, 0.12);
    const scale = 68 / Math.max(spanX, spanY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const mapped = raw.map((p) => ({
      x: 50 + (p.x - cx) * scale,
      y: 50 + (p.y - cy) * scale,
    }));

    return {
      points: mapped,
      isDynamic: letter === 'J' || letter === 'Z',
    };
  }, [letter]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`ASL hand landmark posture for letter ${letter}`}
    >
      <defs>
        <linearGradient id={`bone-grad-${letter}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>

      {/* Subtle palm polygon fill for instant silhouette clarity */}
      <polygon
        points={`${points[0].x},${points[0].y} ${points[1].x},${points[1].y} ${points[5].x},${points[5].y} ${points[9].x},${points[9].y} ${points[13].x},${points[13].y} ${points[17].x},${points[17].y}`}
        fill="rgba(34, 211, 238, 0.09)"
      />

      {/* Dynamic motion cue arrow for J and Z */}
      {isDynamic && letter === 'J' && (
        <path
          d="M 78 24 L 78 58 Q 78 74 62 72"
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2.2"
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
      )}
      {isDynamic && letter === 'Z' && (
        <path
          d="M 24 22 L 74 22 L 26 62 L 76 62"
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2.2"
          strokeDasharray="3 3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Bone connections */}
      {HAND_CONNECTIONS.map(([a, b], idx) => (
        <line
          key={idx}
          x1={points[a].x}
          y1={points[a].y}
          x2={points[b].x}
          y2={points[b].y}
          stroke={`url(#bone-grad-${letter})`}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.92"
        />
      ))}

      {/* 21 Landmark Nodes */}
      {points.map((pt, idx) => {
        const isTip = FINGERTIPS.has(idx);
        return (
          <g key={idx}>
            {isTip && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r={4.8}
                fill="rgba(34, 211, 238, 0.2)"
              />
            )}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={isTip ? 2.8 : idx === 0 ? 3.1 : 2.1}
              fill={isTip ? '#e0f2fe' : '#38bdf8'}
              stroke="#040711"
              strokeWidth="0.9"
            />
          </g>
        );
      })}
    </svg>
  );
}
