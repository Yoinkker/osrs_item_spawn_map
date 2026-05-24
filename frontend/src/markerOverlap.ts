export function overlapPosition(
  x: number,
  y: number,
  index: number,
  total: number,
): { x: number; y: number } {
  if (total <= 1) return { x, y };
  if (total === 2) {
    const dx = index === 0 ? -1 : 1;
    return { x: x + dx, y };
  }
  const radius = Math.min(3, 1 + total * 0.5);
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: x + Math.round(Math.cos(angle) * radius),
    y: y + Math.round(Math.sin(angle) * radius),
  };
}

export function overlapKey(mapId: number, plane: number, x: number, y: number): string {
  return `${mapId}:${plane}:${x}:${y}`;
}
