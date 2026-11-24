import { defineConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node';

// The scenarios share one live stack: run files strictly in name order (01..10), never reordered by cache/duration.
class NameSequencer extends BaseSequencer {
  async sort(files: Parameters<BaseSequencer['sort']>[0]) { return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId)); }
}
export default defineConfig({
  test: {
    include: ['test/**/*.e2e.ts'], testTimeout: 90_000, hookTimeout: 90_000, fileParallelism: false,
    globalSetup: ['./test/global.ts'], setupFiles: ['./src/http.ts'],
    sequence: { sequencer: NameSequencer },
  },
});
