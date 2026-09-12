/** Seconds of visible, unpaused animation time. Theme changes do not reset it. */
export function leafPose(seconds: number, reducedMotion = false) {
  const progress = reducedMotion ? 1 : Math.min(1, Math.max(0, seconds / 2.4));
  const remaining = (1 - progress) ** 3;
  const opening = reducedMotion || progress < 1
    ? 0
    : (1 - Math.cos(((seconds - 2.4) / 6) * Math.PI * 2)) / 2;
  return {
    x: 1.4 * remaining,
    y: 6 * remaining,
    yaw: -0.22 + 1.1 * remaining,
    roll: -0.07 + 0.65 * remaining + Math.sin(progress * Math.PI * 2) * remaining * 0.12,
    opening,
  };
}
