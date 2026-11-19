import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyHands, classifySingleHand, extractHandFeatures } from './aslClassifier';
import { ALL_STATIC_LETTERS, generateDemoHandLandmarks } from './demoHandPoses';
import { GestureTemporalSmoother } from './temporalSmoother';

test('feature extraction is translation and scale invariant', () => {
  const base = generateDemoHandLandmarks('L', { centerX: 0.4, centerY: 0.7, scale: 0.2 });
  const shiftedScaled = generateDemoHandLandmarks('L', { centerX: 0.7, centerY: 0.55, scale: 0.34 });

  const f1 = extractHandFeatures(base, 'Right');
  const f2 = extractHandFeatures(shiftedScaled, 'Right');

  assert.equal(f1.length, 39);
  for (let i = 0; i < f1.length; i++) {
    assert.ok(
      Math.abs(f1[i] - f2[i]) < 0.05,
      `Feature ${i} differed too much under shift/scale: ${f1[i]} vs ${f2[i]}`,
    );
  }
});

test('all 24 static ASL letters classify accurately with strong confidence', () => {
  for (const letter of ALL_STATIC_LETTERS) {
    const landmarks = generateDemoHandLandmarks(letter);
    const pred = classifySingleHand(landmarks, 'Right');
    assert.equal(
      pred.label,
      letter,
      `Expected ${letter} but got ${pred.label} (status: ${pred.status}, top: ${JSON.stringify(pred.topCandidates)})`,
    );
    assert.equal(pred.status, 'recognized');
    assert.ok(pred.confidence >= 0.75, `Expected confidence >= 0.75 for ${letter}, got ${pred.confidence}`);
  }
});

test('left-hand mirrored pose classifies identically to right-hand pose', () => {
  for (const letter of ['A', 'B', 'F', 'L', 'V', 'Y']) {
    const leftLandmarks = generateDemoHandLandmarks(letter, { mirror: true });
    const pred = classifySingleHand(leftLandmarks, 'Left');
    assert.equal(pred.label, letter, `Left hand ${letter} misclassified as ${pred.label}`);
  }
});

test('ambiguous resting hand and single open palm are rejected rather than randomly guessed', () => {
  const neutral = generateDemoHandLandmarks('NEUTRAL_REST');
  const neutralPred = classifySingleHand(neutral, 'Right');
  assert.equal(neutralPred.label, null);
  assert.ok(
    neutralPred.status === 'uncertain' || neutralPred.status === 'unsupported',
    `Expected uncertain/unsupported for neutral rest, got ${neutralPred.status}`,
  );

  const openPalm = generateDemoHandLandmarks('OPEN_PALM');
  const palmPred = classifySingleHand(openPalm, 'Right');
  assert.equal(palmPred.label, null);
  assert.equal(palmPred.status, 'unsupported');
});

test('two-hand dual open palms triggers space utility gesture', () => {
  const rightPalm = generateDemoHandLandmarks('OPEN_PALM', { centerX: 0.65 });
  const leftPalm = generateDemoHandLandmarks('OPEN_PALM', { centerX: 0.35, mirror: true });
  const pred = classifyHands([
    { landmarks: rightPalm, handedness: 'Right' },
    { landmarks: leftPalm, handedness: 'Left' },
  ]);
  assert.equal(pred.status, 'two-hand-space');
  assert.equal(pred.label, 'SPACE');
  assert.equal(pred.handCount, 2);
});

test('temporal smoother requires repeated-frame confirmation and prevents spam', () => {
  const smoother = new GestureTemporalSmoother({
    windowSize: 5,
    confirmFrames: 6,
    sameLetterCooldownFrames: 12,
  });

  const poseH = [{ landmarks: generateDemoHandLandmarks('H'), handedness: 'Right' as const }];

  let committed = 0;
  for (let i = 0; i < 10; i++) {
    const res = smoother.update(poseH, i * 50);
    if (res.committedLetter === 'H') committed += 1;
  }
  assert.equal(committed, 1, 'Expected H to commit exactly once within 10 frames');
});

test('temporal smoother detects dynamic J and Z motion trajectories', () => {
  const smootherJ = new GestureTemporalSmoother();
  let committedJ = false;
  for (let i = 0; i <= 18; i++) {
    const phase = i / 18;
    const pose = [{ landmarks: generateDemoHandLandmarks('J', { phase }), handedness: 'Right' as const }];
    const res = smootherJ.update(pose, i * 45);
    if (res.committedLetter === 'J' && res.isDynamic) {
      committedJ = true;
      break;
    }
  }
  assert.equal(committedJ, true, 'Expected dynamic J trajectory to be detected and committed');

  const smootherZ = new GestureTemporalSmoother();
  let committedZ = false;
  for (let i = 0; i <= 22; i++) {
    const phase = i / 22;
    const pose = [{ landmarks: generateDemoHandLandmarks('Z', { phase }), handedness: 'Right' as const }];
    const res = smootherZ.update(pose, i * 45);
    if (res.committedLetter === 'Z' && res.isDynamic) {
      committedZ = true;
      break;
    }
  }
  assert.equal(committedZ, true, 'Expected dynamic Z trajectory to be detected and committed');
});
