import type { HandDetection, Landmark3D, SmoothedResult } from '../types';
import { classifyHands } from './aslClassifier';

interface TrajectoryPoint {
  x: number;
  y: number;
  t: number;
}

export interface SmootherConfig {
  /** Sliding vote window size */
  windowSize: number;
  /** Consecutive stable smoothed frames needed to confirm & commit a letter */
  confirmFrames: number;
  /** Minimum frames before the exact same letter can be re-committed */
  sameLetterCooldownFrames: number;
}

const DEFAULT_CONFIG: SmootherConfig = {
  windowSize: 7,
  confirmFrames: 10,
  sameLetterCooldownFrames: 26,
};

/**
 * Temporal Smoother + Repeated-Frame Confirmation + Dynamic Trajectory Analyzer
 *
 * Smooths raw frame-level predictions to eliminate single-frame jitter, tracks
 * fingertip motion trajectories to recognize dynamic ASL signs (J and Z), and
 * requires sustained confirmation before appending characters to the composed text.
 */
export class GestureTemporalSmoother {
  private config: SmootherConfig;
  private labelWindow: (string | null)[] = [];
  private activeCandidate: string | null = null;
  private stableCount = 0;
  private lastCommittedLabel: string | null = null;
  private framesSinceLastCommit = 999;

  // Dynamic sign motion trails
  private pinkyTrail: TrajectoryPoint[] = [];
  private indexTrail: TrajectoryPoint[] = [];
  private dynamicCooldown = 0;

  constructor(config: Partial<SmootherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public setConfirmFrames(frames: number) {
    this.config.confirmFrames = Math.max(4, Math.min(24, Math.round(frames)));
  }

  public reset() {
    this.labelWindow = [];
    this.activeCandidate = null;
    this.stableCount = 0;
    this.lastCommittedLabel = null;
    this.framesSinceLastCommit = 999;
    this.pinkyTrail = [];
    this.indexTrail = [];
    this.dynamicCooldown = 0;
  }

  public getTrails(): { pinky: TrajectoryPoint[]; index: TrajectoryPoint[] } {
    return {
      pinky: this.pinkyTrail,
      index: this.indexTrail,
    };
  }

  /**
   * Analyzes pinky fingertip trail for the curved downward-then-inward 'J' motion.
   */
  private detectDynamicJ(trail: TrajectoryPoint[]): number {
    if (trail.length < 10) return 0;
    const first = trail[0];
    const last = trail[trail.length - 1];

    // Find lowest point (largest Y in screen coordinates)
    let maxYIdx = 0;
    for (let i = 1; i < trail.length; i++) {
      if (trail[i].y > trail[maxYIdx].y) maxYIdx = i;
    }
    const bottom = trail[maxYIdx];

    const dropDown = bottom.y - first.y;
    const hookSide = Math.abs(last.x - bottom.x);
    const totalDx = Math.abs(last.x - first.x);

    // Must drop down first, then curve sideways/inward near bottom
    if (maxYIdx >= 3 && maxYIdx <= trail.length - 2 && dropDown > 0.08 && (hookSide > 0.035 || totalDx > 0.07)) {
      const score = Math.min(0.95, 0.72 + dropDown * 0.9 + totalDx * 0.8);
      return Number(score.toFixed(3));
    }
    return 0;
  }

  /**
   * Analyzes index fingertip trail for the 3-segment zigzag 'Z' motion:
   * horizontal -> diagonal back -> horizontal.
   */
  private detectDynamicZ(trail: TrajectoryPoint[]): number {
    if (trail.length < 12) return 0;

    // Split trail into 3 roughly equal segments
    const n = trail.length;
    const p0 = trail[0];
    const p1 = trail[Math.floor(n * 0.33)];
    const p2 = trail[Math.floor(n * 0.67)];
    const p3 = trail[n - 1];

    const seg1Dx = p1.x - p0.x;
    const seg1Dy = Math.abs(p1.y - p0.y);

    const seg2Dx = p2.x - p1.x;
    const seg2Dy = p2.y - p1.y;

    const seg3Dx = p3.x - p2.x;
    const seg3Dy = Math.abs(p3.y - p2.y);

    // Check zigzag direction reversal (works left-to-right or mirrored right-to-left)
    const dir = Math.sign(seg1Dx);
    if (dir === 0) return 0;

    const firstStrokeOk = Math.abs(seg1Dx) > 0.08 && seg1Dy < Math.abs(seg1Dx) * 0.65;
    const diagonalOk = Math.sign(seg2Dx) === -dir && Math.abs(seg2Dx) > 0.07 && seg2Dy > 0.07;
    const thirdStrokeOk = Math.sign(seg3Dx) === dir && Math.abs(seg3Dx) > 0.08 && seg3Dy < Math.abs(seg3Dx) * 0.65;

    if (firstStrokeOk && diagonalOk && thirdStrokeOk) {
      const magnitude = Math.abs(seg1Dx) + seg2Dy + Math.abs(seg3Dx);
      return Number(Math.min(0.96, 0.76 + magnitude * 0.35).toFixed(3));
    }
    return 0;
  }

  public update(hands: HandDetection[], timestampMs = Date.now()): SmoothedResult {
    this.framesSinceLastCommit += 1;
    if (this.dynamicCooldown > 0) this.dynamicCooldown -= 1;

    const raw = classifyHands(hands);

    if (raw.status === 'no-hand' || hands.length === 0) {
      this.labelWindow = [];
      this.activeCandidate = null;
      this.stableCount = 0;
      this.pinkyTrail = [];
      this.indexTrail = [];
      // Lifting hand clears same-letter latch so signing double letters like "LL" works naturally
      this.lastCommittedLabel = null;
      return {
        stableLabel: null,
        displayLabel: null,
        confidence: 0,
        status: 'no-hand',
        reason: raw.reason,
        stabilityProgress: 0,
        committedLetter: null,
        committedAction: null,
        topCandidates: [],
        isDynamic: false,
        handCount: 0,
      };
    }

    const primaryHand = hands.find((h) => h.handedness === 'Right') ?? hands[0];
    const primaryLandmarks: Landmark3D[] = primaryHand.landmarks;
    const wrist = primaryLandmarks[0];
    const dWrist = (idx: number) =>
      Math.hypot(primaryLandmarks[idx].x - wrist.x, primaryLandmarks[idx].y - wrist.y);
    const palmLen = Math.max(dWrist(9), 1e-4);

    const indexExtended = dWrist(8) / palmLen > 1.45;
    const middleExtended = dWrist(12) / palmLen > 1.45;
    const ringExtended = dWrist(16) / palmLen > 1.35;
    const pinkyExtended = dWrist(20) / palmLen > 1.25;

    // Track dynamic trajectories for J (pinky only extended) and Z (index only extended)
    const isPinkyPointing = pinkyExtended && !indexExtended && !middleExtended && !ringExtended;
    if (isPinkyPointing || raw.label === 'I') {
      this.pinkyTrail.push({ x: primaryLandmarks[20].x, y: primaryLandmarks[20].y, t: timestampMs });
      if (this.pinkyTrail.length > 26) this.pinkyTrail.shift();
    } else if (this.pinkyTrail.length > 0) {
      this.pinkyTrail.shift();
    }

    const isIndexPointing = indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
    if (isIndexPointing || raw.label === 'D') {
      this.indexTrail.push({ x: primaryLandmarks[8].x, y: primaryLandmarks[8].y, t: timestampMs });
      if (this.indexTrail.length > 28) this.indexTrail.shift();
    } else if (this.indexTrail.length > 0) {
      this.indexTrail.shift();
    }

    // Evaluate dynamic J and Z trajectories before static confirmation
    if (this.dynamicCooldown === 0) {
      const jConfidence = this.detectDynamicJ(this.pinkyTrail);
      if (jConfidence > 0.72) {
        this.pinkyTrail = [];
        this.dynamicCooldown = 20;
        this.stableCount = 0;
        this.lastCommittedLabel = 'J';
        this.framesSinceLastCommit = 0;
        return {
          stableLabel: 'J',
          displayLabel: 'J',
          confidence: jConfidence,
          status: 'recognized',
          reason: 'Dynamic trajectory matched: Pinky J-hook motion confirmed.',
          stabilityProgress: 1,
          committedLetter: 'J',
          committedAction: 'letter',
          topCandidates: [
            { letter: 'J', confidence: jConfidence },
            ...raw.topCandidates.slice(0, 2),
          ],
          isDynamic: true,
          handCount: raw.handCount,
        };
      }

      const zConfidence = this.detectDynamicZ(this.indexTrail);
      if (zConfidence > 0.72) {
        this.indexTrail = [];
        this.dynamicCooldown = 20;
        this.stableCount = 0;
        this.lastCommittedLabel = 'Z';
        this.framesSinceLastCommit = 0;
        return {
          stableLabel: 'Z',
          displayLabel: 'Z',
          confidence: zConfidence,
          status: 'recognized',
          reason: 'Dynamic trajectory matched: Index Z-zigzag motion confirmed.',
          stabilityProgress: 1,
          committedLetter: 'Z',
          committedAction: 'letter',
          topCandidates: [
            { letter: 'Z', confidence: zConfidence },
            ...raw.topCandidates.slice(0, 2),
          ],
          isDynamic: true,
          handCount: raw.handCount,
        };
      }
    }

    // Push frame label into sliding smoothing window
    const frameLabel =
      raw.status === 'recognized' || raw.status === 'two-hand-space' ? raw.label : null;
    this.labelWindow.push(frameLabel);
    if (this.labelWindow.length > this.config.windowSize) {
      this.labelWindow.shift();
    }

    // Majority vote across smoothing window
    const counts = new Map<string, number>();
    for (const lbl of this.labelWindow) {
      if (lbl) counts.set(lbl, (counts.get(lbl) ?? 0) + 1);
    }

    let majorityLabel: string | null = null;
    let majorityCount = 0;
    for (const [lbl, cnt] of counts.entries()) {
      if (cnt > majorityCount) {
        majorityLabel = lbl;
        majorityCount = cnt;
      }
    }

    const quorum = Math.ceil(this.labelWindow.length * 0.6);
    const smoothedLabel = majorityLabel && majorityCount >= quorum ? majorityLabel : null;

    if (smoothedLabel && smoothedLabel === this.activeCandidate) {
      this.stableCount += 1;
    } else {
      this.activeCandidate = smoothedLabel;
      this.stableCount = smoothedLabel ? 1 : 0;
    }

    const canCommitSame = this.framesSinceLastCommit >= this.config.sameLetterCooldownFrames;
    const isBlockedByCooldown =
      smoothedLabel !== null && smoothedLabel === this.lastCommittedLabel && !canCommitSame;

    let committedLetter: string | null = null;
    let committedAction: 'letter' | 'space' | null = null;

    if (
      smoothedLabel &&
      this.stableCount >= this.config.confirmFrames &&
      !isBlockedByCooldown
    ) {
      if (smoothedLabel === 'SPACE') {
        committedAction = 'space';
      } else {
        committedLetter = smoothedLabel;
        committedAction = 'letter';
      }
      this.lastCommittedLabel = smoothedLabel;
      this.framesSinceLastCommit = 0;
      this.stableCount = 0;
    }

    const progress =
      smoothedLabel && !isBlockedByCooldown
        ? Math.min(1, this.stableCount / this.config.confirmFrames)
        : 0;

    return {
      stableLabel: smoothedLabel,
      displayLabel: smoothedLabel ?? raw.label,
      confidence: raw.confidence,
      status: raw.status,
      reason: raw.reason,
      stabilityProgress: Number(progress.toFixed(3)),
      committedLetter,
      committedAction,
      topCandidates: raw.topCandidates,
      isDynamic: false,
      handCount: raw.handCount,
    };
  }
}
