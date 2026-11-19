import type { HandDetection } from '../types';

export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [9, 13], [13, 14], [14, 15], [15, 16],// Ring
  [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [0, 17],                              // Palm base
];

const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

interface TrailPoint {
  x: number;
  y: number;
}

export function drawHandOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  hands: HandDetection[],
  options: {
    mirror?: boolean;
    trails?: { pinky: TrailPoint[]; index: TrailPoint[] };
    showGrid?: boolean;
  } = {},
) {
  ctx.clearRect(0, 0, width, height);

  if (options.showGrid) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  const mapX = (nx: number) => (options.mirror ? (1 - nx) * width : nx * width);
  const mapY = (ny: number) => ny * height;

  // Draw dynamic motion trails (for J and Z signs)
  if (options.trails) {
    const drawTrail = (points: TrailPoint[], strokeColor: string) => {
      if (points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(mapX(points[0].x), mapY(points[0].y));
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(mapX(points[i].x), mapY(points[i].y));
      }
      ctx.stroke();
      ctx.restore();
    };
    drawTrail(options.trails.pinky, 'rgba(167, 139, 250, 0.85)');
    drawTrail(options.trails.index, 'rgba(34, 211, 238, 0.85)');
  }

  hands.forEach((hand, handIndex) => {
    const isPrimary = handIndex === 0;
    const boneColor = isPrimary ? 'rgba(34, 211, 238, 0.88)' : 'rgba(167, 139, 250, 0.85)';
    const nodeFill = isPrimary ? '#38bdf8' : '#a78bfa';
    const tipFill = isPrimary ? '#e0f2fe' : '#ede9fe';
    const glowColor = isPrimary ? 'rgba(34, 211, 238, 0.65)' : 'rgba(167, 139, 250, 0.65)';

    // Draw bones
    ctx.save();
    ctx.strokeStyle = boneColor;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;

    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = hand.landmarks[a];
      const pb = hand.landmarks[b];
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(mapX(pa.x), mapY(pa.y));
      ctx.lineTo(mapX(pb.x), mapY(pb.y));
      ctx.stroke();
    }
    ctx.restore();

    // Draw landmark joints
    ctx.save();
    hand.landmarks.forEach((pt, idx) => {
      const x = mapX(pt.x);
      const y = mapY(pt.y);
      const isTip = FINGERTIPS.has(idx);
      const radius = isTip ? 5.2 : idx === 0 ? 5.5 : 3.4;

      if (isTip) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = isPrimary ? 'rgba(34, 211, 238, 0.18)' : 'rgba(167, 139, 250, 0.18)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? tipFill : nodeFill;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#040711';
      ctx.stroke();
    });
    ctx.restore();
  });
}
