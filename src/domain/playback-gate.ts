/** New play/stop requests invalidate in-flight asynchronous loads. */
export class PlaybackGate {
  private generation = 0;
  next(): number {
    return ++this.generation;
  }
  isCurrent(generation: number): boolean {
    return generation === this.generation;
  }
  cancel(): void {
    this.generation++;
  }
}

export type Output = {
  kind: "bluetooth" | "wired" | "speaker" | "other" | "unknown";
  name: string;
  supported: boolean;
};

export function isExternal(output: Output): boolean {
  return (
    output.supported && (output.kind === "bluetooth" || output.kind === "wired")
  );
}

export function outputWasLost(previous: Output, next: Output): boolean {
  return (
    isExternal(previous) &&
    (!isExternal(next) ||
      previous.kind !== next.kind ||
      previous.name !== next.name)
  );
}
