import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function nightExists(runsDir: string, night: string): boolean {
  return existsSync(join(runsDir, `${night}.jsonl`));
}
