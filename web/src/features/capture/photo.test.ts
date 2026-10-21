import { describe, expect, it } from 'vitest';
import { fitWithin } from './photo';

describe('fitWithin', () => {
  it('scales the longest edge down to 1024', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 768, height: 1024 });
  });
  it('never upscales', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
