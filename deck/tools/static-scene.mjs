/** Browser-side settling for static layout audits. Media decoding is awaited by the caller.
 * A timer alone cannot tell whether a source viewport's second layout pass has finished. */
export async function settleStaticScene() {
  const root = document.querySelector('.slide.course-slide');
  if (!root) throw new Error('No current static scene');
  const start = performance.now();
  let previous = '', stable = 0, samples = 0;
  while (performance.now() - start < 650) {
    await new Promise(requestAnimationFrame);
    samples += 1;
    const signature = [...root.querySelectorAll('*')]
      .filter(e => !e.closest('[aria-hidden="true"],.course-bg'))
      .map(e => {
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        return [r.x,r.y,r.width,r.height].map(x => Math.round(x * 10)).join(',')
          + s.opacity + s.visibility;
      }).join('|');
    stable = signature === previous ? stable + 1 : 0;
    previous = signature;
    if (stable >= 3 && samples >= 4) return { samples, ms: performance.now() - start };
  }
  throw new Error('Static scene did not settle');
}
