import { decodeSubmissionHistory } from './submissionHistory.js';
import { validateWritingHistory } from './writingHistory.js';
import { deriveSubmissionStatistics } from './submissionStatistics.js';

export function normalizeMaxGrade(value) {
  if (value === null || value === undefined || value === '') return null;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 100
  )
    throw new Error(
      'Grade must be a whole number from 1 to 100, or left blank.',
    );
  return value;
}
export function validateScore(value, maximum = 100) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > maximum ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
  )
    throw new Error(
      `Enter a grade from 0 to ${maximum}, with at most two decimal places.`,
    );
  return value;
}
export function splitStudentName(value = '') {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  return { name: parts[0] || '', surname: parts.slice(1).join(' ') };
}
export function completeOnTime(submittedAt, deadline) {
  const submitted = Date.parse(submittedAt);
  if (!Number.isFinite(submitted)) return null;
  if (!deadline) return true;
  const due = Date.parse(deadline);
  return Number.isFinite(due) ? submitted <= due : null;
}
export async function finalPastedPercent(finalText, encodedHistory) {
  try {
    const events = await decodeSubmissionHistory(encodedHistory);
    const integrity = validateWritingHistory(events, finalText);
    if (integrity.status !== 'complete') return null;
    const stats = deriveSubmissionStatistics({
      finalText,
      eventLog: events,
      integrity,
      reportedStats: {},
    });
    return finalText.length
      ? Math.min(
          100,
          Math.max(0, (stats.finalPastedCharacters / finalText.length) * 100),
        )
      : 0;
  } catch {
    return null;
  }
}
export function sortGradeRows(rows, key, direction = 'asc') {
  const collator = new Intl.Collator(undefined, {
    sensitivity: 'base',
    numeric: true,
  });
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[key],
      y = b[key];
    if (x === null || x === undefined || x === '')
      return y === null || y === undefined || y === ''
        ? a.id.localeCompare(b.id)
        : 1;
    if (y === null || y === undefined || y === '') return -1;
    const order =
      typeof x === 'string' ? collator.compare(x, y) : Number(x) - Number(y);
    return order * sign || a.id.localeCompare(b.id);
  });
}
export function normalizeMoodleEmail(value) {
  const email = typeof value === 'string' ? value.trim() : '';
  for (const character of email) {
    if (character.codePointAt(0) < 32 || character.codePointAt(0) === 127)
      throw new Error('Enter the student’s exact Moodle email address.');
  }
  if (
    email.length > 254 ||
    !/^[^\s@",;<>]+@[^\s@",;<>]+\.[^\s@",;<>]+$/u.test(email) ||
    /^[=+\-@]/.test(email)
  )
    throw new Error('Enter the student’s exact Moodle email address.');
  return email;
}
export function buildMoodleCsv(rows) {
  if (!rows.length) throw new Error('Select at least one graded submission.');
  const seen = new Set();
  const cells = [['Email address', 'Grade']];
  for (const row of rows) {
    const email = normalizeMoodleEmail(row.email);
    if (seen.has(email.toLowerCase()))
      throw new Error(
        'The same Moodle email is assigned to more than one selected submission. Select one submission per student.',
      );
    seen.add(email.toLowerCase());
    cells.push([email, String(validateScore(row.score))]);
  }
  return (
    cells
      .map((row) =>
        row.map((value) => '"' + value.replaceAll('"', '""') + '"').join(','),
      )
      .join('\r\n') + '\r\n'
  );
}
