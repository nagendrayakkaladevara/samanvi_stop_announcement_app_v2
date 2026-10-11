export function createPlaybackAlertStorage(userId: string) {
  const prefix = `samanvi.playback-alerts.${userId}.`;
  return {
    async read(): Promise<unknown[]> {
      return Object.keys(localStorage).filter((key) => key.startsWith(prefix)).map((key) => JSON.parse(localStorage.getItem(key)!));
    },
    async write(id: string, value: unknown) { localStorage.setItem(prefix + id, JSON.stringify(value)); },
    async remove(id: string) { localStorage.removeItem(prefix + id); },
  };
}
