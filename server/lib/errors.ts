/** An error that is safe to show to the user. Anything else becomes a generic 500. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    /** Field name -> message, for form validation errors. */
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message, 'bad_request');
export const unauthorized = (message = 'Please log in to continue.') => new HttpError(401, message, 'unauthorized');
export const notFound = (message = 'Not found.') => new HttpError(404, message, 'not_found');
export const conflict = (message: string) => new HttpError(409, message, 'conflict');
