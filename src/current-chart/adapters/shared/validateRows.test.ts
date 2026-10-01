import { z } from 'zod';
import { validateRows } from './validateRows';

const schema = z.object({ code: z.string(), n: z.number() });

describe('validateRows', () => {
  it('keeps valid rows and reports invalid ones with their index', () => {
    const result = validateRows('test', schema, [
      { code: 'A', n: 1 },
      { code: 'B', n: 'x' },
      { code: 'C', n: 3, extra: true },
    ]);
    expect(result.rows).toEqual([
      { code: 'A', n: 1 },
      { code: 'C', n: 3 },
    ]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ source: 'test', severity: 'warning', row: 1 });
    expect(result.diagnostics[0]?.message).toContain('n');
  });

  it('reports a non-array payload as an error', () => {
    const result = validateRows('test', schema, { code: 'A' });
    expect(result.rows).toEqual([]);
    expect(result.diagnostics).toEqual([
      { source: 'test', severity: 'error', message: 'Expected an array of rows' },
    ]);
  });
});
