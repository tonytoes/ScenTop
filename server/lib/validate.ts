import { z } from 'zod';
import { HttpError } from './errors';

/** Validates request data. On failure the client gets one message per field. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'form';
    fields[key] ??= issue.message;
  }
  throw new HttpError(400, 'Please check the highlighted fields.', 'validation', fields);
}

const required = (label: string) => z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`);

export const schemas = {
  id: z.coerce.number().int().positive(),
  email: z.email('Enter a valid e-mail address.').trim().max(254),
  password: z
    .string({ error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password is too long.'),
  name: (label: string) => required(label).max(60, `${label} is too long.`),
  phone: z
    .string({ error: 'Phone number is required.' })
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Enter a valid phone number.'),
  required,
};
