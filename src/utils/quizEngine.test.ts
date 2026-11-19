import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuizQuestions, pickNextPracticeLetter } from './quizEngine';

test('generateQuizQuestions creates unique questions with 4 distinct options containing the answer', () => {
  const questions = generateQuizQuestions(10, 42);
  assert.equal(questions.length, 10);

  const seenTargets = new Set<string>();
  for (const q of questions) {
    assert.ok(!seenTargets.has(q.target.letter), `Duplicate target letter ${q.target.letter}`);
    seenTargets.add(q.target.letter);
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.ok(q.options.includes(q.target.letter));
  }
});

test('pickNextPracticeLetter prefers unmastered letters and avoids repeating current letter', () => {
  const mastered = new Set<string>([
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
    'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
  ]);
  const next = pickNextPracticeLetter('Y', mastered, 7);
  assert.equal(next.letter, 'Z');
});
