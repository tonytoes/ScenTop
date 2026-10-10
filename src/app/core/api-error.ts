/** What every failed API call turns into, so pages only deal with one kind of error. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the server could not be reached. */
    public readonly status: number,
    public readonly code?: string,
    /** Field name -> message, for form validation errors from the server. */
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** A message that is safe to show to the user for any thrown value. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}
