import { FormGroup } from '@angular/forms';
import { ApiError } from './api-error';

/**
 * Shows the server's field messages under the matching form fields.
 * Returns true when at least one field was marked, so the page knows the error is already visible.
 */
export function applyServerErrors(form: FormGroup, error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;

  let applied = false;
  for (const [name, message] of Object.entries(error.fields)) {
    const control = form.get(name);
    if (!control) continue;
    control.setErrors({ server: message });
    control.markAsTouched();
    applied = true;
  }
  return applied;
}
