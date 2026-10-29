import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, NightDigest, ReadNight } from './types.js';

type LogEvent = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error?: string;
};

const STATUSES = new Set<JobStatus>(['ok', 'retry', 'fail']);

function parseLine(line: string): LogEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.has(o.status as JobStatus)) return null;
  if (!('owner' in o)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as JobStatus,
    owner: o.owner,
    error: o.error,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) {
    return { night, rows: [], badLines: 0 };
  }

  const text = readFileSync(path, 'utf8');
  const lines = text.length === 0 ? [] : text.split('\n');

  let badLines = 0;
  const byJob = new Map<string, DigestRow>();

  for (const line of lines) {
    if (line === '') continue;
    const event = parseLine(line);
    if (!event) {
      badLines += 1;
      continue;
    }

    const existing = byJob.get(event.job);
    if (!existing) {
      byJob.set(event.job, {
        job: event.job,
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error ?? null,
        firstAt: event.at,
        lastAt: event.at,
      });
      continue;
    }

    existing.runs += 1;
    if (event.status === 'retry') existing.retries += 1;
    existing.owner = event.owner;
    existing.lastStatus = event.status;
    existing.lastError = event.error ?? null;
    existing.lastAt = event.at;
  }

  const rows = [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
  return { night, rows, badLines };
};
