import { Directory, File, Paths } from "expo-file-system";

export function createPlaybackAlertStorage(userId: string) {
  const directory = new Directory(Paths.document, "playback-alerts-v1", encodeURIComponent(userId));
  const ensure = () => directory.create({ intermediates: true, idempotent: true });
  return {
    async read(): Promise<unknown[]> {
      ensure();
      return Promise.all(directory.list().filter((file): file is File => file instanceof File && file.name.endsWith(".json")).map(async (file) => JSON.parse(await file.text())));
    },
    async write(id: string, value: unknown) {
      ensure();
      const temp = new File(directory, `${id}.tmp`);
      temp.write(JSON.stringify(value));
      await temp.move(new File(directory, `${id}.json`), { overwrite: true });
    },
    async remove(id: string) { const file = new File(directory, `${id}.json`); if (file.exists) file.delete(); },
  };
}
