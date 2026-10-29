import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('aggregates runs/2026-10-28.jsonl into 5 jobs and counts 1 bad line', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest.night).toBe('2026-10-28');
    expect(digest.badLines).toBe(1);
    expect(digest.rows).toHaveLength(5);
    expect(digest.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);

    const digestRender = digest.rows.find((r) => r.job === 'digest/render')!;
    expect(digestRender.owner).toBeNull();
    expect(digestRender.lastStatus).toBe('ok');
    expect(digestRender.runs).toBe(1);

    const fixtures = digest.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fixtures.retries).toBe(3);
    expect(fixtures.runs).toBe(4);
    expect(fixtures.lastStatus).toBe('ok');

    const backup = digest.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });
});
