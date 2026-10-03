import { requireOptionalNativeModule, type NativeModule } from "expo";
import type { Output } from "../../src/domain/playback-gate";

type Events = { onRouteChange: (output: Output) => void };
type RouteModule = InstanceType<typeof NativeModule<Events>> & {
  getSnapshot(): Promise<Output>;
};
export default requireOptionalNativeModule<RouteModule>("SamanviAudioRoute");
