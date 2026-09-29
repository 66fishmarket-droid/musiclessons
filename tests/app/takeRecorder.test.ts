import { describe, expect, it } from 'vitest';
import { createTakeRecorder } from '../../src/audio/takeRecorder.ts';

class FakeTrack { stopped = false; stop() { this.stopped = true; } }
class FakeStream { tracks = [new FakeTrack()]; getTracks() { return this.tracks; } }
class FakeRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/mp4';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['take']) }); this.onstop?.(); }
}

function rig() {
  const streams: FakeStream[] = [];
  const recorders: FakeRecorder[] = [];
  const takes: Blob[] = [];
  let release: (() => void) | null = null;
  let gate = Promise.resolve();
  const rec = createTakeRecorder({
    getUserMedia: async () => { await gate; const s = new FakeStream(); streams.push(s); return s as unknown as MediaStream; },
    makeRecorder: () => { const r = new FakeRecorder(); recorders.push(r); return r as unknown as MediaRecorder; },
    onTake: b => takes.push(b),
  });
  const hold = () => { gate = new Promise(r => { release = r; }); };
  return { rec, streams, recorders, takes, hold, release: () => release?.() };
}

describe('takeRecorder', () => {
  it('records, delivers the take on stop, and releases the mic', async () => {
    const t = rig();
    await t.rec.start();
    expect(t.rec.recording).toBe(true);
    t.rec.stop();
    expect(t.takes).toHaveLength(1);
    expect(t.takes[0].type).toBe('audio/mp4');
    expect(t.streams[0].tracks[0].stopped).toBe(true);
    expect(t.rec.recording).toBe(false);
  });

  it('dispose while recording (leaving the block) still delivers the take and turns the mic off', async () => {
    const t = rig();
    await t.rec.start();
    t.rec.dispose();
    expect(t.takes).toHaveLength(1);
    expect(t.streams[0].tracks[0].stopped).toBe(true);
  });

  it('ignores a second start while the mic prompt is pending (no second stream)', async () => {
    const t = rig();
    t.hold();
    const a = t.rec.start();
    const b = t.rec.start();
    t.release();
    await Promise.all([a, b]);
    expect(t.streams).toHaveLength(1);
    expect(t.recorders).toHaveLength(1);
  });

  it('dispose before the mic arrives never starts recording and closes the stream', async () => {
    const t = rig();
    t.hold();
    const a = t.rec.start();
    t.rec.dispose();
    t.release();
    await a;
    expect(t.recorders).toHaveLength(0);
    expect(t.streams[0].tracks[0].stopped).toBe(true);
    expect(t.takes).toHaveLength(0);
  });
});
