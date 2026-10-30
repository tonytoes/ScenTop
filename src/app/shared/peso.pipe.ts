import { Pipe, PipeTransform } from '@angular/core';

const formatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

/** Shows an amount in centavos as pesos: 185000 | peso  ->  ₱1,850.00 */
@Pipe({ name: 'peso' })
export class PesoPipe implements PipeTransform {
  transform(cents: number | null | undefined): string {
    return formatter.format((cents ?? 0) / 100);
  }
}
