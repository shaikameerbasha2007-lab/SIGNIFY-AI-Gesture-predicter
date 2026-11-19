import type { Landmark3D } from '../types';

/**
 * Forward-kinematics generator for anatomically structured 21-point MediaPipe
 * hand landmarks for every ASL alphabet letter A-Z, plus neutral resting and
 * open-palm poses. Used for:
 *  1. Calibrating canonical anatomical prototypes in the ML classifier
 *  2. Driving Interactive Demo Mode through the exact same classifier & canvas
 *     pipeline when webcam access is unavailable.
 */

interface FingerCurlSpec {
  /** 0 = fully straight, 1 = tightly curled into palm */
  mcpCurl: number;
  pipCurl: number;
  /** lateral spread in radians (+ right, - left in right-hand palm-forward frame) */
  splay: number;
  /** forward z lean (negative = toward camera) */
  zLean?: number;
}

interface ThumbSpec {
  /** normalized offset from wrist in local hand frame (palm unit = 1) */
  cmc: [number, number, number];
  mcp: [number, number, number];
  ip: [number, number, number];
  tip: [number, number, number];
}

interface HandPoseSpec {
  /** Global rotation in image plane (radians, 0 = fingers pointing straight up) */
  roll?: number;
  /** Pitch forward/down in radians (positive = tips tilt downward toward camera/floor) */
  pitch?: number;
  thumb: ThumbSpec;
  index: FingerCurlSpec;
  middle: FingerCurlSpec;
  ring: FingerCurlSpec;
  pinky: FingerCurlSpec;
  /** Optional explicit overrides in local palm-unit coords for nuanced touches (R cross, O pinch, etc.) */
  overrides?: Partial<Record<number, [number, number, number]>>;
}

const FINGER_BASES: Record<'index' | 'middle' | 'ring' | 'pinky', [number, number, number]> = {
  index: [-0.34, -0.94, 0],
  middle: [-0.08, -1.0, 0],
  ring: [0.18, -0.94, 0],
  pinky: [0.42, -0.82, 0.02],
};

const FINGER_LENGTHS: Record<'index' | 'middle' | 'ring' | 'pinky', [number, number, number]> = {
  index: [0.42, 0.27, 0.2],
  middle: [0.46, 0.3, 0.22],
  ring: [0.42, 0.27, 0.2],
  pinky: [0.34, 0.22, 0.17],
};

function buildFinger(
  finger: 'index' | 'middle' | 'ring' | 'pinky',
  spec: FingerCurlSpec,
): [number, number, number][] {
  const [bx, by, bz] = FINGER_BASES[finger];
  const [l1, l2, l3] = FINGER_LENGTHS[finger];

  // Angle from straight up (-y) toward palm (+y, -z)
  const a1 = spec.mcpCurl * Math.PI * 0.62;
  const a2 = a1 + spec.pipCurl * Math.PI * 0.58;
  const a3 = a2 + spec.pipCurl * Math.PI * 0.36;

  const splaySin = Math.sin(spec.splay);
  const splayCos = Math.cos(spec.splay);
  const zLean = spec.zLean ?? 0;

  const step = (
    origin: [number, number, number],
    len: number,
    angle: number,
  ): [number, number, number] => {
    const dy = -Math.cos(angle) * len;
    const dz = -Math.sin(angle) * len + zLean * len;
    const dx = splaySin * Math.cos(angle * 0.6) * len;
    return [origin[0] + dx, origin[1] + dy * splayCos, origin[2] + dz];
  };

  const mcp: [number, number, number] = [bx, by, bz];
  const pip = step(mcp, l1, a1);
  const dip = step(pip, l2, a2);
  const tip = step(dip, l3, a3);
  return [mcp, pip, dip, tip];
}

const CURLED: FingerCurlSpec = { mcpCurl: 0.92, pipCurl: 0.96, splay: 0 };
const CURVED_C: FingerCurlSpec = { mcpCurl: 0.35, pipCurl: 0.45, splay: 0, zLean: -0.25 };
const CURVED_O: FingerCurlSpec = { mcpCurl: 0.52, pipCurl: 0.68, splay: 0, zLean: -0.35 };
const CURVED_E: FingerCurlSpec = { mcpCurl: 0.68, pipCurl: 0.95, splay: 0, zLean: -0.18 };

const THUMB_TUCKED_PALM: ThumbSpec = {
  cmc: [-0.36, -0.26, -0.05],
  mcp: [-0.46, -0.52, -0.1],
  ip: [-0.22, -0.68, -0.18],
  tip: [0.06, -0.72, -0.22],
};

const THUMB_ACROSS_FIST: ThumbSpec = {
  cmc: [-0.38, -0.28, -0.08],
  mcp: [-0.48, -0.58, -0.18],
  ip: [-0.24, -0.78, -0.32],
  tip: [0.04, -0.8, -0.35],
};

const THUMB_SIDE_A: ThumbSpec = {
  cmc: [-0.4, -0.28, -0.04],
  mcp: [-0.56, -0.56, -0.08],
  ip: [-0.56, -0.84, -0.1],
  tip: [-0.52, -1.08, -0.1],
};

const THUMB_EXTENDED: ThumbSpec = {
  cmc: [-0.42, -0.26, -0.03],
  mcp: [-0.66, -0.44, -0.05],
  ip: [-0.88, -0.56, -0.06],
  tip: [-1.1, -0.64, -0.06],
};

const POSE_SPECS: Record<string, HandPoseSpec> = {
  A: {
    thumb: THUMB_SIDE_A,
    index: { mcpCurl: 0.94, pipCurl: 0.96, splay: 0 },
    middle: CURLED,
    ring: CURLED,
    pinky: CURLED,
  },
  B: {
    thumb: {
      cmc: [-0.34, -0.25, -0.06],
      mcp: [-0.42, -0.48, -0.12],
      ip: [-0.14, -0.64, -0.18],
      tip: [0.16, -0.7, -0.2],
    },
    index: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0.03 },
    middle: { mcpCurl: 0.01, pipCurl: 0.01, splay: 0 },
    ring: { mcpCurl: 0.02, pipCurl: 0.02, splay: -0.02 },
    pinky: { mcpCurl: 0.03, pipCurl: 0.03, splay: -0.04 },
  },
  C: {
    thumb: {
      cmc: [-0.4, -0.24, -0.08],
      mcp: [-0.6, -0.48, -0.16],
      ip: [-0.62, -0.78, -0.26],
      tip: [-0.46, -1.02, -0.36],
    },
    index: CURVED_C,
    middle: CURVED_C,
    ring: CURVED_C,
    pinky: CURVED_C,
  },
  D: {
    thumb: {
      cmc: [-0.36, -0.26, -0.06],
      mcp: [-0.44, -0.54, -0.16],
      ip: [-0.28, -0.82, -0.28],
      tip: [-0.08, -1.04, -0.42],
    },
    index: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0 },
    middle: { mcpCurl: 0.45, pipCurl: 0.62, splay: 0, zLean: -0.28 },
    ring: { mcpCurl: 0.72, pipCurl: 0.85, splay: 0 },
    pinky: { mcpCurl: 0.78, pipCurl: 0.88, splay: 0 },
    overrides: {
      12: [-0.06, -1.06, -0.43], // middle tip touches thumb tip
    },
  },
  E: {
    thumb: {
      cmc: [-0.34, -0.24, -0.08],
      mcp: [-0.42, -0.48, -0.16],
      ip: [-0.16, -0.62, -0.22],
      tip: [0.16, -0.64, -0.24],
    },
    index: CURVED_E,
    middle: CURVED_E,
    ring: CURVED_E,
    pinky: CURVED_E,
  },
  F: {
    thumb: {
      cmc: [-0.36, -0.26, -0.06],
      mcp: [-0.48, -0.56, -0.14],
      ip: [-0.44, -0.86, -0.26],
      tip: [-0.32, -1.08, -0.36],
    },
    index: { mcpCurl: 0.48, pipCurl: 0.65, splay: 0, zLean: -0.25 },
    middle: { mcpCurl: 0.03, pipCurl: 0.03, splay: -0.05 },
    ring: { mcpCurl: 0.03, pipCurl: 0.03, splay: 0.06 },
    pinky: { mcpCurl: 0.04, pipCurl: 0.04, splay: 0.16 },
    overrides: {
      8: [-0.3, -1.1, -0.38], // index tip pinched to thumb tip
    },
  },
  G: {
    roll: -Math.PI * 0.48,
    thumb: {
      cmc: [-0.38, -0.28, -0.04],
      mcp: [-0.54, -0.58, -0.08],
      ip: [-0.56, -0.92, -0.1],
      tip: [-0.54, -1.26, -0.1],
    },
    index: { mcpCurl: 0.03, pipCurl: 0.03, splay: -0.02 },
    middle: CURLED,
    ring: CURLED,
    pinky: CURLED,
  },
  H: {
    roll: -Math.PI * 0.48,
    thumb: THUMB_TUCKED_PALM,
    index: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0.04 },
    middle: { mcpCurl: 0.02, pipCurl: 0.02, splay: -0.04 },
    ring: CURLED,
    pinky: CURLED,
  },
  I: {
    thumb: THUMB_ACROSS_FIST,
    index: CURLED,
    middle: CURLED,
    ring: CURLED,
    pinky: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0.05 },
  },
  J: {
    // Dynamic sign: starts from I handshape and sweeps in J-curve via animation phase
    thumb: THUMB_ACROSS_FIST,
    index: CURLED,
    middle: CURLED,
    ring: CURLED,
    pinky: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0.05 },
  },
  K: {
    thumb: {
      cmc: [-0.36, -0.26, -0.04],
      mcp: [-0.46, -0.58, -0.08],
      ip: [-0.3, -0.94, -0.14],
      tip: [-0.14, -1.28, -0.16], // pressed up between index & middle
    },
    index: { mcpCurl: 0.02, pipCurl: 0.02, splay: -0.14 },
    middle: { mcpCurl: 0.14, pipCurl: 0.04, splay: 0.12, zLean: -0.15 },
    ring: CURLED,
    pinky: CURLED,
  },
  L: {
    thumb: THUMB_EXTENDED,
    index: { mcpCurl: 0.02, pipCurl: 0.02, splay: -0.02 },
    middle: CURLED,
    ring: CURLED,
    pinky: CURLED,
  },
  M: {
    thumb: {
      cmc: [-0.32, -0.24, -0.04],
      mcp: [-0.3, -0.48, -0.06],
      ip: [0.02, -0.62, -0.08],
      tip: [0.3, -0.68, -0.05], // thumb peeks between ring & pinky
    },
    index: { mcpCurl: 0.86, pipCurl: 0.84, splay: 0, zLean: -0.12 },
    middle: { mcpCurl: 0.86, pipCurl: 0.84, splay: 0, zLean: -0.12 },
    ring: { mcpCurl: 0.86, pipCurl: 0.84, splay: 0, zLean: -0.12 },
    pinky: CURLED,
  },
  N: {
    thumb: {
      cmc: [-0.32, -0.24, -0.04],
      mcp: [-0.34, -0.5, -0.06],
      ip: [-0.08, -0.68, -0.08],
      tip: [0.08, -0.74, -0.06], // thumb peeks between middle & ring
    },
    index: { mcpCurl: 0.86, pipCurl: 0.84, splay: 0, zLean: -0.12 },
    middle: { mcpCurl: 0.86, pipCurl: 0.84, splay: 0, zLean: -0.12 },
    ring: CURLED,
    pinky: CURLED,
  },
  O: {
    thumb: {
      cmc: [-0.38, -0.26, -0.08],
      mcp: [-0.52, -0.54, -0.18],
      ip: [-0.46, -0.84, -0.32],
      tip: [-0.24, -1.04, -0.46],
    },
    index: CURVED_O,
    middle: CURVED_O,
    ring: CURVED_O,
    pinky: CURVED_O,
    overrides: {
      8: [-0.26, -1.06, -0.48],
      12: [-0.14, -1.08, -0.48],
      16: [0.0, -1.04, -0.44],
      20: [0.14, -0.96, -0.38],
    },
  },
  P: {
    roll: Math.PI * 0.84,
    thumb: {
      cmc: [-0.36, -0.26, -0.04],
      mcp: [-0.46, -0.58, -0.08],
      ip: [-0.3, -0.94, -0.14],
      tip: [-0.14, -1.28, -0.16],
    },
    index: { mcpCurl: 0.04, pipCurl: 0.04, splay: -0.12 },
    middle: { mcpCurl: 0.16, pipCurl: 0.04, splay: 0.12, zLean: -0.15 },
    ring: CURLED,
    pinky: CURLED,
  },
  Q: {
    roll: Math.PI * 0.94,
    thumb: {
      cmc: [-0.38, -0.28, -0.04],
      mcp: [-0.54, -0.58, -0.08],
      ip: [-0.56, -0.92, -0.1],
      tip: [-0.54, -1.26, -0.1],
    },
    index: { mcpCurl: 0.03, pipCurl: 0.03, splay: -0.02 },
    middle: CURLED,
    ring: CURLED,
    pinky: CURLED,
  },
  R: {
    thumb: THUMB_TUCKED_PALM,
    index: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0.16 },
    middle: { mcpCurl: 0.02, pipCurl: 0.02, splay: -0.22, zLean: 0.08 },
    ring: CURLED,
    pinky: CURLED,
    overrides: {
      7: [-0.14, -1.62, -0.04],
      8: [-0.08, -1.82, -0.05], // index crosses right
      11: [-0.22, -1.72, 0.06],
      12: [-0.28, -1.92, 0.08], // middle crosses left behind index
    },
  },
  S: {
    thumb: THUMB_ACROSS_FIST,
    index: CURLED,
    middle: CURLED,
    ring: CURLED,
    pinky: CURLED,
  },
  T: {
    thumb: {
      cmc: [-0.36, -0.26, -0.05],
      mcp: [-0.44, -0.54, -0.08],
      ip: [-0.34, -0.82, -0.1],
      tip: [-0.22, -1.0, -0.16], // thumb tip peeks upward between index & middle
    },
    index: { mcpCurl: 0.88, pipCurl: 0.88, splay: -0.06, zLean: -0.12 },
    middle: CURLED,
    ring: CURLED,
    pinky: CURLED,
  },
  U: {
    thumb: THUMB_TUCKED_PALM,
    index: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0.1 },
    middle: { mcpCurl: 0.02, pipCurl: 0.02, splay: -0.08 },
    ring: CURLED,
    pinky: CURLED,
    overrides: {
      8: [-0.2, -1.83, 0],
      12: [-0.12, -1.96, 0], // tightly touching upright
    },
  },
  V: {
    thumb: THUMB_TUCKED_PALM,
    index: { mcpCurl: 0.02, pipCurl: 0.02, splay: -0.24 },
    middle: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0.22 },
    ring: CURLED,
    pinky: CURLED,
  },
  W: {
    thumb: {
      cmc: [-0.34, -0.24, -0.06],
      mcp: [-0.36, -0.48, -0.12],
      ip: [-0.02, -0.62, -0.18],
      tip: [0.34, -0.66, -0.22], // touches curled pinky
    },
    index: { mcpCurl: 0.02, pipCurl: 0.02, splay: -0.22 },
    middle: { mcpCurl: 0.01, pipCurl: 0.01, splay: 0 },
    ring: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0.22 },
    pinky: CURLED,
  },
  X: {
    thumb: THUMB_TUCKED_PALM,
    index: { mcpCurl: 0.16, pipCurl: 0.86, splay: 0, zLean: -0.2 },
    middle: CURLED,
    ring: CURLED,
    pinky: CURLED,
  },
  Y: {
    thumb: THUMB_EXTENDED,
    index: CURLED,
    middle: CURLED,
    ring: CURLED,
    pinky: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0.26 },
  },
  Z: {
    // Dynamic sign: index extended, sweeps a Z-zigzag via animation phase
    thumb: THUMB_TUCKED_PALM,
    index: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0 },
    middle: CURLED,
    ring: CURLED,
    pinky: CURLED,
  },
  OPEN_PALM: {
    thumb: THUMB_EXTENDED,
    index: { mcpCurl: 0.01, pipCurl: 0.01, splay: -0.24 },
    middle: { mcpCurl: 0.01, pipCurl: 0.01, splay: -0.04 },
    ring: { mcpCurl: 0.01, pipCurl: 0.01, splay: 0.14 },
    pinky: { mcpCurl: 0.02, pipCurl: 0.02, splay: 0.34 },
  },
  NEUTRAL_REST: {
    // Ambiguous non-ASL handshape (tilted mixed-finger pose) for uncertain/unsupported rejection
    roll: 0.62,
    thumb: THUMB_EXTENDED,
    index: { mcpCurl: 0.08, pipCurl: 0.12, splay: -0.28 },
    middle: { mcpCurl: 0.58, pipCurl: 0.62, splay: 0.05 },
    ring: { mcpCurl: 0.12, pipCurl: 0.18, splay: 0.24 },
    pinky: { mcpCurl: 0.55, pipCurl: 0.6, splay: 0.32 },
  },
};

function rotate2D(x: number, y: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c];
}

/**
 * Computes the screen-space wrist offset for dynamic letters J & Z given phase in [0, 1].
 */
function getDynamicOffset(letter: string, phase: number): [number, number] {
  const t = Math.max(0, Math.min(1, phase));
  if (letter === 'J') {
    // Downward stem then curved hook inward (left) and slightly up
    if (t < 0.45) {
      const u = t / 0.45;
      return [0.06, -0.09 + u * 0.17];
    }
    const u = (t - 0.45) / 0.55;
    const angle = u * Math.PI * 0.85;
    return [0.06 - (1 - Math.cos(angle)) * 0.08, 0.08 + Math.sin(angle) * 0.05 - u * 0.06];
  }
  if (letter === 'Z') {
    // Top stroke left->right, diagonal top-right->bottom-left, bottom stroke left->right
    if (t < 0.33) {
      const u = t / 0.33;
      return [-0.1 + u * 0.2, -0.09];
    }
    if (t < 0.67) {
      const u = (t - 0.33) / 0.34;
      return [0.1 - u * 0.2, -0.09 + u * 0.18];
    }
    const u = (t - 0.67) / 0.33;
    return [-0.1 + u * 0.2, 0.09];
  }
  return [0, 0];
}

export interface GeneratePoseOptions {
  /** Center X in normalized canvas coords (default 0.5) */
  centerX?: number;
  /** Center Y of wrist in normalized canvas coords (default 0.72) */
  centerY?: number;
  /** Palm scale in normalized canvas height (default 0.22) */
  scale?: number;
  /** Animation phase 0..1 for dynamic signs J and Z or subtle breathing micro-motion */
  phase?: number;
  /** Mirror horizontally for left hand */
  mirror?: boolean;
}

export function generateDemoHandLandmarks(
  poseKey: string,
  options: GeneratePoseOptions = {},
): Landmark3D[] {
  const key = poseKey.toUpperCase();
  const spec = POSE_SPECS[key] ?? POSE_SPECS.NEUTRAL_REST;
  const scale = options.scale ?? 0.22;
  const phase = options.phase ?? 0;
  const mirrorSign = options.mirror ? -1 : 1;

  const [dynDx, dynDy] = getDynamicOffset(key, phase);
  const cx = (options.centerX ?? 0.5) + dynDx;
  const cy = (options.centerY ?? 0.72) + dynDy;

  const raw: [number, number, number][] = [
    [0, 0, 0], // 0: Wrist
    spec.thumb.cmc,
    spec.thumb.mcp,
    spec.thumb.ip,
    spec.thumb.tip,
    ...buildFinger('index', spec.index),
    ...buildFinger('middle', spec.middle),
    ...buildFinger('ring', spec.ring),
    ...buildFinger('pinky', spec.pinky),
  ];

  if (spec.overrides) {
    for (const [idxStr, coords] of Object.entries(spec.overrides)) {
      if (coords) {
        raw[Number(idxStr)] = coords;
      }
    }
  }

  const roll = spec.roll ?? 0;
  const isSideways = Math.abs(roll) > 0.7 && Math.abs(roll) < 2.2;
  const isDownward = Math.abs(roll) >= 2.2;
  const adjustedCy = isDownward ? cy - 0.34 : isSideways ? cy - 0.16 : cy;
  const adjustedCx = isSideways ? cx + 0.14 : cx;

  return raw.map(([lx, ly, lz]) => {
    const [rx, ry] = rotate2D(lx * mirrorSign, ly, roll * mirrorSign);
    return {
      x: adjustedCx + rx * scale * 0.85,
      y: adjustedCy + ry * scale,
      z: lz * scale,
    };
  });
}

export const ALL_STATIC_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y',
] as const;

export const ALL_ASL_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
] as const;
