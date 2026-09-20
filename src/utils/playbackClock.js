// One monotonic anchor survives UI renders and timer throttling.
export function createPlaybackClock({ durationMs, now = () => performance.now() }) {
  let time = 0;
  let anchor = now();
  let speed = 1;
  let playing = false;
  const clamp = (value) => Math.max(0, Math.min(durationMs, value));
  function read() { return clamp(time + (playing ? Math.max(0, now() - anchor) * speed : 0)); }
  function seek(value) { time = clamp(value); anchor = now(); }
  return {
    read, seek,
    play() { if (!playing) { anchor = now(); playing = true; } },
    pause() { seek(read()); playing = false; },
    setSpeed(value) { seek(read()); speed = value; },
  };
}
