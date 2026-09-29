import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeContext {
  static made = 0;
  state: string = 'running';
  resumed = 0;
  constructor() { FakeContext.made++; }
  resume() { this.resumed++; this.state = 'running'; return Promise.resolve(); }
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); FakeContext.made = 0; });

describe('audio()', () => {
  it('creates one context and resumes it whenever it is not running (iOS reports "interrupted" after a call or lock)', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const { audio } = await import('../../src/audio/clock.ts');
    const ac = audio() as unknown as FakeContext;
    expect(FakeContext.made).toBe(1);
    for (const state of ['suspended', 'interrupted']) {
      ac.state = state;
      expect(audio()).toBe(ac as unknown as AudioContext);
    }
    expect(ac.resumed).toBe(2);
    audio();
    expect(ac.resumed).toBe(2); // running: left alone
    expect(FakeContext.made).toBe(1);
  });
});
