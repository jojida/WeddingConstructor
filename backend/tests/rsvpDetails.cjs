const test = require('node:test');
const assert = require('node:assert/strict');

const { attendanceOf, cleanAnswers, parseAnswers, summarizeAnswers } = require('../dist/lib/rsvpDetails.js');

test('статус старых ответов берётся из attending', () => {
  assert.equal(attendanceOf({ attendance: '', attending: true }), 'yes');
  assert.equal(attendanceOf({ attendance: '', attending: false }), 'no');
  assert.equal(attendanceOf({ attendance: 'maybe', attending: false }), 'maybe');
  assert.equal(attendanceOf({ attendance: 'nonsense', attending: true }), 'yes');
});

test('ответы: пустые отбрасываются, мусор — отказ целиком', () => {
  assert.deepEqual(cleanAnswers(undefined), []);
  assert.deepEqual(
    cleanAnswers([{ id: 'menu', q: 'Горячее', a: ' Рыба ', t: 'one' }, { id: 'song', q: 'Песня', a: '   ' }]),
    [{ id: 'menu', q: 'Горячее', a: 'Рыба', t: 'one' }],
  );
  assert.equal(cleanAnswers({ id: 'menu' }), null);
  assert.equal(cleanAnswers([{ id: 'Bad Id!', q: 'x', a: 'y' }]), null);
  assert.equal(cleanAnswers([{ id: 'menu', q: 'x', a: 'y', t: 'radio' }]), null);
  assert.equal(cleanAnswers([{ id: 'menu', q: 'x', a: 'y'.repeat(1001) }]), null);
  assert.equal(cleanAnswers(Array.from({ length: 13 }, (_, i) => ({ id: 'q' + i, q: 'x', a: 'y' }))), null);
});

test('битый JSON в базе — пустой список', () => {
  assert.deepEqual(parseAnswers('{oops'), []);
  assert.deepEqual(parseAnswers(''), []);
});

test('сводка считает варианты, свободные ответы пропускает', () => {
  const summary = summarizeAnswers([
    [{ id: 'menu', q: 'Горячее', a: 'Рыба', t: 'one' }, { id: 'song', q: 'Песня', a: 'ABBA', t: 'text' }],
    [{ id: 'menu', q: 'Горячее', a: 'Рыба', t: 'one' }, { id: 'transfer', q: 'Трансфер', a: 'Туда, Обратно', t: 'many' }],
  ]);
  assert.deepEqual(summary.map(s => [s.id, { ...s.counts }]), [
    ['menu', { 'Рыба': 2 }],
    ['transfer', { 'Туда': 1, 'Обратно': 1 }],
  ]);
});
