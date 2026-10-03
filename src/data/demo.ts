import type { AudioAsset, Bootstrap, RouteManifest } from "../domain/catalog";

const timestamp = "2026-09-26T00:00:00.000Z";
function audio(
  id: string,
  title: string,
  sizeBytes: string,
  category: AudioAsset["category"],
): AudioAsset {
  return {
    id,
    title,
    sizeBytes,
    category,
    description: null,
    originalFileName: `${id}.mp3`,
    mimeType: "audio/mpeg",
    durationMs: null,
    checksumSha256: null,
    status: "ready",
    blobUrl: null,
    downloadUrl: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
export const demoAudio = [
  audio("demo-dinner", "Dinner break", "100770", "common_audio"),
  audio("demo-toilet", "Toilet break", "119969", "common_audio"),
  audio("demo-vijayawada", "Vijayawada", "58380", "stop_announcement"),
  audio("demo-visakhapatnam", "Visakhapatnam", "56712", "stop_announcement"),
];
export const demoAssets: Record<string, number> = {
  "demo-dinner": require("../../assets/audio/dinner.mp3"),
  "demo-toilet": require("../../assets/audio/toilet.mp3"),
  "demo-vijayawada": require("../../assets/audio/vijayawada.mp3"),
  "demo-visakhapatnam": require("../../assets/audio/visakhapatnam.mp3"),
};
const route = {
  id: "demo-route",
  routeCode: "DEMO-VJA-VSKP",
  name: "Vijayawada to Visakhapatnam",
  origin: "Vijayawada",
  destination: "Visakhapatnam",
  version: 1,
  updatedAt: timestamp,
};
export const demoBootstrap: Bootstrap = {
  welcomeAudio: null,
  commonAudios: demoAudio.slice(0, 2),
  routes: [{ ...route, _count: { audios: 2 } }],
};
export const demoManifest: RouteManifest = {
  ...route,
  description: "A sample route for audio testing.",
  audios: demoAudio.slice(2).map((item, position) => ({
    position,
    stopLabel: item.title,
    audio: item,
  })),
};
