import { z } from 'zod';
import { ActionInputError } from '../action-input-error';

export function parseMcqAnswer(value: unknown): number {
  // Number(null), Number('') and Number(false) all become zero, a valid option.
  if (typeof value !== 'number' && !(typeof value === 'string' && /^[0-3]$/.test(value))) {
    throw new ActionInputError('Answer every MCQ before submitting');
  }
  const answer = Number(value);
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) throw new ActionInputError('Invalid MCQ option');
  return answer;
}

const id = z.number().int().positive().max(2147483647);
const marks = z.number().finite().positive().max(10000);
const prompt = z.string().trim().min(1).max(10000);

/** Shared by the web Server Action and the mobile HTTP endpoint. */
export const onlineTestSchema = z.object({
  sectionId: id,
  subjectId: id,
  title: z.string().trim().min(1).max(255),
  mode: z.enum(['MCQ', 'MIX']),
  durationMinutes: z.number().int().positive().max(1440),
  mcqs: z.array(z.object({
    prompt,
    options: z.array(z.string().trim().min(1).max(2000)).length(4),
    correctOptionIndex: z.number().int().min(0).max(3),
    marks,
  }).strict()).min(1).max(200),
  shortQuestions: z.array(z.object({ prompt, marks }).strict()).max(100).default([]),
}).strict().superRefine((value, context) => {
  if (value.mode === 'MIX' && value.shortQuestions.length === 0) {
    context.addIssue({ code: 'custom', path: ['shortQuestions'], message: 'Mix tests need at least one short question' });
  }
  if (value.mode === 'MCQ' && value.shortQuestions.length > 0) {
    context.addIssue({ code: 'custom', path: ['shortQuestions'], message: 'MCQ tests cannot contain short questions' });
  }
});
