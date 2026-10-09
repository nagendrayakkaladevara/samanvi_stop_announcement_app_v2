export type RepeatPlaybackState = {
  audioId: string | null;
  count: number;
};

export const initialRepeatPlaybackState: RepeatPlaybackState = {
  audioId: null,
  count: 0,
};

export function shouldWarnBeforePlayback(
  state: RepeatPlaybackState,
  audioId: string,
  limit = 3,
) {
  return state.audioId === audioId && state.count >= limit;
}

export function recordPlayback(
  state: RepeatPlaybackState,
  audioId: string,
): RepeatPlaybackState {
  return state.audioId === audioId
    ? { audioId, count: state.count + 1 }
    : { audioId, count: 1 };
}
