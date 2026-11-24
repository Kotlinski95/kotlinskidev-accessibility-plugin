export interface PointerTracker {
  stop(): void;
}

export const trackPointerY = (onMove: (y: number) => void): PointerTracker => {
  let frame = 0;
  let pending = window.innerHeight / 2;

  const flush = (): void => {
    frame = 0;
    onMove(pending);
  };

  const schedule = (y: number): void => {
    pending = y;
    if (frame === 0) frame = window.requestAnimationFrame(flush);
  };

  const onPointerMove = (event: MouseEvent): void => schedule(event.clientY);

  const onTouchMove = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (touch) schedule(touch.clientY);
  };

  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  onMove(pending);

  const stop = (): void => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('touchmove', onTouchMove);
    if (frame !== 0) window.cancelAnimationFrame(frame);
    frame = 0;
  };

  return { stop };
};
