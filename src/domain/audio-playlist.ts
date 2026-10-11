export function adjacentAudio<T extends { id: string }>(playlist: readonly T[], activeId: string | null | undefined, direction: -1 | 1): T | null {
  const index = playlist.findIndex((audio) => audio.id === activeId);
  return index >= 0 ? playlist[index + direction] ?? null : null;
}
