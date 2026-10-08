export function remainingSeconds(deadline, now = Date.now()) {
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}
