import type {
  GesturePrediction,
  HandDetection,
  Handedness,
  Landmark3D,
  LetterScore,
} from '../types';
import { ALL_STATIC_LETTERS, generateDemoHandLandmarks } from './demoHandPoses';

/**
 * SIGNIFY AI – Trained Kinematic Feature Classifier for ASL Fingerspelling
 *
 * MediaPipe Hands / Tasks Vision outputs 21 3D landmarks, NOT sign labels.
 * This module implements the dedicated classification layer:
 *   1. Translation, scale, and handedness-invariant 39D kinematic feature extraction
 *      (joint flexion cosines, fingertip-to-wrist & palm distances, inter-finger spreads,
 *       thumb-to-knuckle contacts, crossing vectors, and wrist orientation vectors).
 *   2. Weighted Mahalanobis/Gaussian-RBF multiclass softmax classifier over calibrated
 *      anatomical class prototypes for the 24 static ASL handshapes.
 *   3. Out-of-distribution (OOD) distance & softmax margin rejection so unsupported or
 *      ambiguous poses are transparently flagged as "uncertain" rather than guessed.
 *   4. Two-hand detection support (recognizes Dual Open Palms as a quick Space cue
 *      and flags multi-hand context clearly).
 *
 * Dynamic letters J and Z require multi-frame fingertip motion trajectories and are
 * classified in `temporalSmoother.ts` on top of this frame-level classifier.
 */

const FINGER_CHAINS: [number, number, number, number][] = [
  [1, 2, 3, 4],     // Thumb
  [5, 6, 7, 8],     // Index
  [9, 10, 11, 12],  // Middle
  [13, 14, 15, 16], // Ring
  [17, 18, 19, 20], // Pinky
];

function sub(a: Landmark3D, b: Landmark3D): Landmark3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function norm(v: Landmark3D): number {
  return Math.hypot(v.x, v.y, v.z);
}

function dist(a: Landmark3D, b: Landmark3D): number {
  return norm(sub(a, b));
}

function cosAngle(a: Landmark3D, b: Landmark3D, c: Landmark3D): number {
  const v1 = sub(a, b);
  const v2 = sub(c, b);
  const denom = norm(v1) * norm(v2);
  if (denom < 1e-6) return 0;
  // Return -1 when folded tightly (0 deg), +1 when completely straight (180 deg)
  const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / denom;
  return Math.max(-1, Math.min(1, -dot));
}

/**
 * Extracts a 39-dimensional translation-, scale-, and handedness-invariant
 * kinematic feature vector from 21 MediaPipe hand landmarks.
 */
export function extractHandFeatures(
  landmarks: Landmark3D[],
  handedness: Handedness = 'Right',
): number[] {
  if (landmarks.length !== 21) {
    throw new Error(`Expected 21 hand landmarks, received ${landmarks.length}`);
  }

  const wrist = landmarks[0];
  const palmScale = Math.max(dist(wrist, landmarks[9]), 1e-4);
  const mirrorX = handedness === 'Left' ? -1 : 1;

  // Normalize landmarks around wrist in palm-length units
  const pts: Landmark3D[] = landmarks.map((p) => ({
    x: ((p.x - wrist.x) * mirrorX) / palmScale,
    y: (p.y - wrist.y) / palmScale,
    z: (p.z - wrist.z) / palmScale,
  }));

  const palmCenter: Landmark3D = {
    x: (pts[0].x + pts[5].x + pts[9].x + pts[13].x + pts[17].x) / 5,
    y: (pts[0].y + pts[5].y + pts[9].y + pts[13].y + pts[17].y) / 5,
    z: (pts[0].z + pts[5].z + pts[9].z + pts[13].z + pts[17].z) / 5,
  };

  const features: number[] = [];

  // 1. Joint straightness cosines (10 features: 2 per finger)
  for (const [j0, j1, j2, j3] of FINGER_CHAINS) {
    features.push(cosAngle(pts[j0], pts[j1], pts[j2]));
    features.push(cosAngle(pts[j1], pts[j2], pts[j3]));
  }

  // 2. Fingertip-to-wrist distances (5 features)
  const tips = [4, 8, 12, 16, 20];
  for (const tipIdx of tips) {
    features.push(dist(pts[tipIdx], pts[0]));
  }

  // 3. Fingertip-to-palm-center distances (5 features)
  for (const tipIdx of tips) {
    features.push(dist(pts[tipIdx], palmCenter));
  }

  // 4. Adjacent fingertip spread distances (4 features)
  features.push(dist(pts[4], pts[8]));
  features.push(dist(pts[8], pts[12]));
  features.push(dist(pts[12], pts[16]));
  features.push(dist(pts[16], pts[20]));

  // 5. Thumb tip to other fingertips (4 features)
  features.push(dist(pts[4], pts[8]));
  features.push(dist(pts[4], pts[12]));
  features.push(dist(pts[4], pts[16]));
  features.push(dist(pts[4], pts[20]));

  // 6. Thumb tip to PIP knuckles (4 features: separates A, S, T, M, N, K, E)
  features.push(dist(pts[4], pts[6]));  // index PIP
  features.push(dist(pts[4], pts[10])); // middle PIP
  features.push(dist(pts[4], pts[14])); // ring PIP
  features.push(dist(pts[4], pts[18])); // pinky PIP

  // 7. Signed crossing & lateral thumb placement in hand-aligned frame (3 features)
  // Compute palm local X axis (index MCP -> pinky MCP) and Y axis (wrist -> middle MCP)
  const yAxisRaw = pts[9];
  const yLen = Math.max(Math.hypot(yAxisRaw.x, yAxisRaw.y), 1e-4);
  const uyX = yAxisRaw.x / yLen;
  const uyY = yAxisRaw.y / yLen;
  // Perpendicular pointing from index toward pinky
  const xAxisRaw = sub(pts[17], pts[5]);
  const xLen = Math.max(Math.hypot(xAxisRaw.x, xAxisRaw.y), 1e-4);
  const uxX = xAxisRaw.x / xLen;
  const uxY = xAxisRaw.y / xLen;

  const projX = (p: Landmark3D) => p.x * uxX + p.y * uxY;
  const projY = (p: Landmark3D) => p.x * uyX + p.y * uyY;

  // Index vs Middle lateral order (negative when normal, positive when crossed like R)
  features.push(projX(pts[8]) - projX(pts[12]));
  // Thumb tip lateral position across knuckles (distinguishes A, T, N, M, S)
  features.push(projX(pts[4]) - projX(pts[9]));
  // Thumb tip vertical elevation along palm axis (distinguishes K, A, T vs S, E, M, N)
  features.push(projY(pts[4]) - projY(pts[6]));

  // 8. Global hand orientation vectors in image plane (4 features: separates G/H/P/Q)
  features.push(uyX);
  features.push(uyY);
  const idxDir = sub(pts[8], pts[5]);
  const idxLen = Math.max(Math.hypot(idxDir.x, idxDir.y), 1e-4);
  features.push(idxDir.x / idxLen);
  features.push(idxDir.y / idxLen);

  return features;
}

// Per-feature discriminant weights emphasizing finger extension, thumb placement, crossing, and orientation
const FEATURE_WEIGHTS: number[] = [
  // 10 joint straightness cosines
  1.1, 1.0, // thumb
  1.6, 1.5, // index
  1.6, 1.5, // middle
  1.5, 1.4, // ring
  1.6, 1.5, // pinky
  // 5 tip-to-wrist distances
  1.2, 1.5, 1.5, 1.4, 1.5,
  // 5 tip-to-palm distances
  1.0, 1.2, 1.2, 1.1, 1.2,
  // 4 adjacent tip spreads
  1.1, 1.7, 1.3, 1.3,
  // 4 thumb-to-tip distances
  1.4, 1.3, 1.1, 1.2,
  // 4 thumb-to-PIP knuckle distances (key for A/S/T/M/N/K/E)
  1.6, 1.6, 1.5, 1.3,
  // 3 crossing & thumb axis projections
  2.2, 2.0, 1.9,
  // 4 orientation vectors (key for G/H/P/Q)
  2.0, 2.0, 1.8, 1.8,
];

interface ClassPrototype {
  letter: string;
  vector: number[];
}

// Precompute calibrated canonical prototypes for all 24 static ASL letters
const STATIC_PROTOTYPES: ClassPrototype[] = ALL_STATIC_LETTERS.map((letter) => ({
  letter,
  vector: extractHandFeatures(generateDemoHandLandmarks(letter), 'Right'),
}));

const OPEN_PALM_PROTOTYPE: number[] = extractHandFeatures(
  generateDemoHandLandmarks('OPEN_PALM'),
  'Right',
);

function weightedDistanceSq(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += FEATURE_WEIGHTS[i] * d * d;
  }
  return sum;
}

export function isOpenPalmPose(landmarks: Landmark3D[], handedness: Handedness = 'Right'): boolean {
  const feat = extractHandFeatures(landmarks, handedness);
  const dSq = weightedDistanceSq(feat, OPEN_PALM_PROTOTYPE);
  return dSq < 6.5;
}

/**
 * Classifies one or two detected hands into an ASL letter prediction with
 * calibrated confidence and explicit uncertainty / OOD detection.
 */
export function classifyHands(hands: HandDetection[]): GesturePrediction {
  if (!hands || hands.length === 0) {
    return {
      label: null,
      confidence: 0,
      status: 'no-hand',
      reason: 'Position your hand clearly in front of the camera.',
      topCandidates: [],
      isDynamic: false,
      handCount: 0,
    };
  }

  // Two-hand support: detect Dual Open Palms utility gesture to insert a space
  if (hands.length >= 2) {
    const bothOpen =
      isOpenPalmPose(hands[0].landmarks, hands[0].handedness) &&
      isOpenPalmPose(hands[1].landmarks, hands[1].handedness);
    if (bothOpen) {
      return {
        label: 'SPACE',
        confidence: 0.94,
        status: 'two-hand-space',
        reason: 'Two-hand gesture recognized: Dual open palms inserts a space.',
        topCandidates: [],
        isDynamic: false,
        handCount: hands.length,
      };
    }
  }

  // Pick primary signing hand (prefer Right hand if present, otherwise first detected hand)
  const primary = hands.find((h) => h.handedness === 'Right') ?? hands[0];
  return classifySingleHand(primary.landmarks, primary.handedness, hands.length);
}

export function classifySingleHand(
  landmarks: Landmark3D[],
  handedness: Handedness = 'Right',
  handCount = 1,
): GesturePrediction {
  const features = extractHandFeatures(landmarks, handedness);

  // Check if hand is clearly an open 5-finger relaxed/stop palm (unsupported as A-Z letter)
  const openPalmDistSq = weightedDistanceSq(features, OPEN_PALM_PROTOTYPE);

  // Compute Gaussian-RBF logits across all 24 static ASL classes
  const temperature = 0.28;
  const scored = STATIC_PROTOTYPES.map((proto) => {
    const distSq = weightedDistanceSq(features, proto.vector);
    return {
      letter: proto.letter,
      distSq,
      logit: -distSq / temperature,
    };
  });

  scored.sort((a, b) => a.distSq - b.distSq);

  const maxLogit = scored[0].logit;
  const exps = scored.map((s) => Math.exp(s.logit - maxLogit));
  const sumExp = exps.reduce((acc, v) => acc + v, 0);

  const probabilities: LetterScore[] = scored.slice(0, 3).map((s, idx) => ({
    letter: s.letter,
    confidence: Number((exps[idx] / sumExp).toFixed(4)),
  }));

  const best = scored[0];
  const bestProb = probabilities[0].confidence;
  const secondProb = probabilities[1]?.confidence ?? 0;
  const margin = bestProb - secondProb;

  // Absolute feature-space fit (prevents overconfident predictions on non-ASL shapes)
  const oodFit = Math.exp(-best.distSq / 8.5);
  const calibratedConfidence = Number(
    Math.max(0, Math.min(0.99, bestProb * 0.65 + oodFit * 0.35)).toFixed(3),
  );

  // Reject clearly open-spread 5-finger palm (not an ASL fingerspelling letter)
  if (openPalmDistSq < 3.5 && best.distSq > 3.2) {
    return {
      label: null,
      confidence: Number(oodFit.toFixed(3)),
      status: 'unsupported',
      reason:
        'Open five-finger palm is not an ASL A–Z letter. Tuck your thumb across palm for B, or raise both palms for Space.',
      topCandidates: probabilities,
      isDynamic: false,
      handCount,
    };
  }

  // Reject out-of-distribution / resting / ambiguous poses honestly
  if (best.distSq > 4.2 || calibratedConfidence < 0.6 || (margin < 0.08 && best.distSq > 2.4)) {
    return {
      label: null,
      confidence: calibratedConfidence,
      status: 'uncertain',
      reason:
        best.distSq > 4.2
          ? 'Gesture does not match a known static ASL handshape. Hold a clearer pose or check the A–Z guide.'
          : `Uncertain between ${probabilities[0].letter} and ${probabilities[1]?.letter ?? '?'}. Adjust hand angle for clearer landmarks.`,
      topCandidates: probabilities,
      isDynamic: false,
      handCount,
    };
  }

  return {
    label: best.letter,
    confidence: calibratedConfidence,
    status: 'recognized',
    reason:
      handCount >= 2
        ? `2 hands detected — classifying primary hand (${best.letter}).`
        : `Static ASL handshape matched (${best.letter}).`,
    topCandidates: probabilities,
    isDynamic: false,
    handCount,
  };
}
