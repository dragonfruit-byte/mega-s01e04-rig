import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

const baseConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
};

describe('digest routes', () => {
  it('GET /digest/:night returns 200 with rows', async () => {
    const runsDir = tempRuns({
      '2026-10-28.jsonl':
        '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\n',
    });
    const res = await createApp({ ...baseConfig, runsDir }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('rig/rotate-logs');
    expect(html).toContain('digest · 2026-10-28');
  });

  it('GET /digest/:night returns 404 when the night file is missing', async () => {
    const runsDir = tempRuns({});
    const res = await createApp({ ...baseConfig, runsDir }).request('/digest/2099-01-01');
    expect(res.status).toBe(404);
  });

  it('GET /digest/:night renders nothing ran for an empty file', async () => {
    const runsDir = tempRuns({ '2026-10-28.jsonl': '' });
    const res = await createApp({ ...baseConfig, runsDir }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('GET /digest/:night still renders when a line is bad', async () => {
    const runsDir = tempRuns({
      '2026-10-28.jsonl':
        '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\n' +
        'not-json\n',
    });
    const res = await createApp({ ...baseConfig, runsDir }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('rig/rotate-logs');
  });

  it('GET /api/digest/:night returns the same jobs in the same order as the page', async () => {
    const runsDir = 'runs';
    const app = createApp({ ...baseConfig, runsDir });
    const page = await app.request('/digest/2026-10-28');
    const api = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    const rows = await api.json();
    const expected = readNight(runsDir, '2026-10-28').rows;
    expect(rows).toEqual(expected);
    const html = await page.text();
    for (const row of expected) {
      expect(html).toContain(row.job);
    }
    const jobOrder = expected.map((r) => r.job);
    let last = -1;
    for (const job of jobOrder) {
      const at = html.indexOf(job);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  it('GET /api/digest/:night returns 404 when the night file is missing', async () => {
    const runsDir = tempRuns({});
    const res = await createApp({ ...baseConfig, runsDir }).request('/api/digest/2099-01-01');
    expect(res.status).toBe(404);
  });
});

describe('board link', () => {
  it('links both nights on disk to digests with counts', async () => {
    const res = await createApp({ ...baseConfig, runsDir: 'runs' }).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toMatch(/2026-10-28[\s\S]*?\d+ ok \/ \d+ retry \/ \d+ fail/);
    expect(html).toMatch(/2026-10-27[\s\S]*?\d+ ok \/ \d+ retry \/ \d+ fail/);
  });
});
