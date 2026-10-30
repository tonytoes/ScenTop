import { PesoPipe } from './peso.pipe';

describe('PesoPipe', () => {
  const pipe = new PesoPipe();

  it('turns centavos into pesos with a peso sign', () => {
    expect(pipe.transform(185000)).toBe('₱1,850.00');
    expect(pipe.transform(5000)).toBe('₱50.00');
  });

  it('keeps centavos', () => {
    expect(pipe.transform(79050)).toBe('₱790.50');
  });

  it('treats a missing amount as zero', () => {
    expect(pipe.transform(null)).toBe('₱0.00');
    expect(pipe.transform(undefined)).toBe('₱0.00');
  });
});
