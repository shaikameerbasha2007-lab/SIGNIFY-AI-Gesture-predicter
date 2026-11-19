import { ASL_ALPHABET } from '../data/aslAlphabet';
import type { ASLLetterInfo } from '../types';

export interface QuizQuestion {
  id: string;
  target: ASLLetterInfo;
  options: string[];
  promptType: 'visual-sign' | 'posture-cue';
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const nextRand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateQuizQuestions(count = 10, seed = Date.now()): QuizQuestion[] {
  const pool = deterministicShuffle(ASL_ALPHABET, seed).slice(0, Math.min(count, ASL_ALPHABET.length));
  return pool.map((target, index) => {
    const distractors = deterministicShuffle(
      ASL_ALPHABET.filter((item) => item.letter !== target.letter),
      seed + (index + 1) * 97,
    )
      .slice(0, 3)
      .map((item) => item.letter);

    const options = deterministicShuffle([target.letter, ...distractors], seed + (index + 1) * 31);
    return {
      id: `q-${index}-${target.letter}`,
      target,
      options,
      promptType: index % 2 === 0 ? 'visual-sign' : 'posture-cue',
    };
  });
}

export function pickNextPracticeLetter(
  currentLetter: string | null,
  mastered: Set<string>,
  seed = Date.now(),
): ASLLetterInfo {
  const unmastered = ASL_ALPHABET.filter(
    (item) => !mastered.has(item.letter) && item.letter !== currentLetter,
  );
  const candidates =
    unmastered.length > 0
      ? unmastered
      : ASL_ALPHABET.filter((item) => item.letter !== currentLetter);

  const index = Math.abs(Math.floor(seed)) % candidates.length;
  return candidates[index];
}
