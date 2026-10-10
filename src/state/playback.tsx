import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Alert, AppState, Platform } from "react-native";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import Constants from "expo-constants";
import AudioRoute from "../../modules/samanvi-audio-route";
import { readableError, type AudioAsset } from "../domain/catalog";
import {
  isExternal,
  outputWasLost,
  PlaybackGate,
  type Output,
} from "../domain/playback-gate";
import type { PlaybackPhase } from "../domain/presentation";
import { useLibrary } from "./library";
import {
  initialRepeatPlaybackState,
  recordPlayback,
  shouldWarnBeforePlayback,
} from "../domain/repeat-playback";

const unknownOutput: Output = {
  kind: "unknown",
  name: "Check on your phone",
  supported: false,
};
const supportsNativeBackgroundPlayback =
  Platform.OS !== "web" && Constants.expoGoConfig == null;
const repeatWarning =
  "You should not play the same audio more than three times.\n\nఒకే ఆడియోను మూడు సార్లకు మించి ప్లే చేయకూడదు.";

function confirmRepeatedPlayback() {
  if (Platform.OS === "web")
    return Promise.resolve(window.confirm(`Repeated announcement\n\n${repeatWarning}`));
  return new Promise<boolean>((resolve) =>
    Alert.alert("Repeated announcement / పునరావృత ప్రకటన", repeatWarning, [
      { text: "Cancel / రద్దు", style: "cancel", onPress: () => resolve(false) },
      { text: "Play anyway / అయినా ప్లే చేయండి", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
type Phase = PlaybackPhase;
type PlaybackContextValue = {
  active: AudioAsset | null;
  playing: boolean;
  phase: Phase;
  position: number;
  duration: number;
  local: boolean;
  output: Output;
  message: string | null;
  play: (audio: AudioAsset, allowPhone?: boolean) => Promise<boolean>;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  replay: () => Promise<void>;
  refreshOutput: () => Promise<Output>;
  dismissMessage: () => void;
};
const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({ children }: PropsWithChildren) {
  const player = useAudioPlayer(null, { updateInterval: 250, downloadFirst: false });
  const status = useAudioPlayerStatus(player);
  const library = useLibrary();
  const { online, preferences, resolveAudio, localAllowed, catalog, offlineValid } = library;
  const libraryRef = useRef(library);
  useEffect(() => { libraryRef.current = library; }, [library]);
  const sourceRef = useRef<{ local: boolean; key: string | null; audio: AudioAsset } | null>(null);
  const [local, setLocal] = useState(false);
  const onlineRef = useRef(online);
  useEffect(() => { onlineRef.current = online; }, [online]);
  const [active, setActive] = useState<AudioAsset | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<Output>(unknownOutput);
  const outputRef = useRef(output);
  const activeRef = useRef<AudioAsset | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const gate = useRef(new PlaybackGate());
  const allowPhoneRef = useRef(false);
  const repeatRef = useRef(initialRepeatPlaybackState);

  const transition = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const lockScreen = useCallback(
    (enabled: boolean, audio?: AudioAsset) => {
      if (supportsNativeBackgroundPlayback)
        player.setActiveForLockScreen(
          enabled,
          audio ? { title: audio.title, artist: "Samanvi Travels" } : undefined,
        );
    },
    [player],
  );

  const acceptOutput = useCallback(
    (next: Output) => {
      if (
        outputWasLost(outputRef.current, next) &&
        activeRef.current &&
        ["loading", "playing", "paused"].includes(phaseRef.current)
      ) {
        gate.current.cancel();
        player.pause();
        lockScreen(false);
        transition("interrupted");
        setMessage(
          "Speaker connection changed. Reconnect, then replay the announcement from the beginning.",
        );
      }
      outputRef.current = next;
      setOutput(next);
    },
    [lockScreen, player, transition],
  );

  const refreshOutput = useCallback(async () => {
    try {
      const next = AudioRoute ? await AudioRoute.getSnapshot() : unknownOutput;
      acceptOutput(next);
      return next;
    } catch {
      acceptOutput(unknownOutput);
      return unknownOutput;
    }
  }, [acceptOutput]);

  useEffect(() => {
    let cancelled = false;
    void AudioRoute?.getSnapshot()
      .then((next) => {
        if (!cancelled) acceptOutput(next);
      })
      .catch(() => {
        if (!cancelled) acceptOutput(unknownOutput);
      });
    const subscription = AudioRoute?.addListener("onRouteChange", acceptOutput);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshOutput();
    });
    return () => {
      cancelled = true;
      subscription?.remove();
      appState.remove();
    };
  }, [acceptOutput, refreshOutput]);

  useEffect(() => {
    const subscription = player.addListener("playbackStatusUpdate", (next) => {
      if (!activeRef.current) return;
      if (next.error) {
        player.pause();
        transition("error");
        setMessage(
          "This audio could not be played. Retry, or refresh your pinned downloads.",
        );
        lockScreen(false);
      } else if (next.didJustFinish) {
        transition("finished");
        lockScreen(false);
      } else if (next.playing) {
        if ((sourceRef.current?.local ? !libraryRef.current.localAllowed(sourceRef.current.audio) : !onlineRef.current) || ["stopped", "interrupted", "error"].includes(phaseRef.current)) {
          player.pause();
          return;
        }
        transition("playing");
      }
      else if (phaseRef.current === "playing" && !next.isBuffering)
        transition("paused");
    });
    return () => subscription.remove();
  }, [player, lockScreen, transition]);

  useEffect(() => {
    if (online || sourceRef.current?.local) return;
    gate.current.cancel();
    player.pause();
    // SDK 57 Android rejects replace(null); pausing plus request cancellation
    // safely stops the stream until a valid source is supplied on replay.
    lockScreen(false);
    if (activeRef.current) {
      transition("interrupted");
      setMessage("Internet connection lost. Reconnect, then replay the announcement.");
    }
  }, [online, player, lockScreen, transition]);

  useEffect(() => {
    const source = sourceRef.current;
    if (source?.local && !localAllowed(source.audio)) {
      gate.current.cancel(); player.pause(); lockScreen(false); transition("interrupted");
      setMessage("This download needs reauthorization or is no longer pinned. Refresh your routes.");
    }
  }, [catalog, offlineValid, localAllowed, player, lockScreen, transition]);

  useEffect(() => () => {
    gate.current.cancel();
    libraryRef.current.releaseAudio(sourceRef.current?.key ?? null);
  }, []);

  useEffect(() => {
    // Queue preparation has its own progress/stall deadline and may legitimately
    // take longer on a weak signal. This timer applies only to the native player.
    if (phase !== "loading" || resolving) return;
    const timeout = setTimeout(() => {
      gate.current.cancel();
      player.pause();
      lockScreen(false);
      transition("error");
      setMessage("Audio took too long to load. Check your connection and retry.");
    }, 30_000);
    return () => clearTimeout(timeout);
  }, [phase, resolving, player, lockScreen, transition]);

  useEffect(() => {
    if (!preferences.keepAwake || !status.playing || Platform.OS === "web")
      return;
    let cancelled = false;
    void activateKeepAwakeAsync("samanvi-playback")
      .then(() => {
        if (cancelled) void deactivateKeepAwake("samanvi-playback");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void deactivateKeepAwake("samanvi-playback");
    };
  }, [preferences.keepAwake, status.playing]);

  const play = useCallback(
    async (audio: AudioAsset, allowPhone = false): Promise<boolean> => {
      const request = gate.current.next();
      setMessage(null);
      try {
        const selectedOutput = await refreshOutput();
        if (!gate.current.isCurrent(request)) return false;
        if (
          preferences.requireSpeaker &&
          !allowPhone &&
          !isExternal(selectedOutput)
        )
           throw new Error(
             "Connect your bus speaker first. You can play a phone test from the speaker screen.",
            );
        if (
          shouldWarnBeforePlayback(repeatRef.current, audio.id) &&
          !(await confirmRepeatedPlayback())
        ) return false;
        if (!gate.current.isCurrent(request)) return false;
        player.pause();
        lockScreen(false);
        activeRef.current = audio;
        setActive(audio);
        setResolving(true);
        transition("loading");
        const source = await resolveAudio(audio);
        if (!gate.current.isCurrent(request)) { libraryRef.current.releaseAudio(source.key); return false; }
        if (!source.local && !onlineRef.current) throw new Error("Connect to play this online-only announcement.");
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: false,
            shouldPlayInBackground: supportsNativeBackgroundPlayback,
            interruptionMode: "doNotMix",
          });
        } catch (failure) { libraryRef.current.releaseAudio(source.key); throw failure; }
        if (!gate.current.isCurrent(request)) {
          libraryRef.current.releaseAudio(source.key); return false;
        }
        if (source.local && !localAllowed(source.audio)) {
          libraryRef.current.releaseAudio(source.key); throw new Error("This audio changed during preparation. Refresh your route.");
        }
        player.pause();
        try { player.replace({ uri: source.uri }); }
        catch (failure) { libraryRef.current.releaseAudio(source.key); throw failure; }
        const previousKey = sourceRef.current?.key;
        if (previousKey) libraryRef.current.releaseAudio(previousKey);
        sourceRef.current = source;
        setLocal(source.local);
        setResolving(false);
        allowPhoneRef.current = allowPhone;
        transition("loading");
        lockScreen(true, audio);
        player.play();
        repeatRef.current = recordPlayback(repeatRef.current, audio.id);
        return true;
      } catch (failure) {
        if (gate.current.isCurrent(request)) {
          setResolving(false);
          if (phaseRef.current === "loading") {
            player.pause();
            lockScreen(false);
            transition("error");
          }
          setMessage(readableError(failure));
        }
        return false;
      }
    },
    [
      preferences.requireSpeaker,
      refreshOutput,
      player,
      transition,
      lockScreen,
      resolveAudio,
      localAllowed,
    ],
  );

  const pause = useCallback(() => {
    gate.current.cancel();
    player.pause();
    transition("paused");
  }, [player, transition]);
  const stop = useCallback(() => {
    gate.current.cancel();
    player.pause();
    lockScreen(false);
    transition("stopped");
    setMessage(null);
    void player.seekTo(0).catch(() => undefined);
  }, [player, lockScreen, transition]);
  const replay = useCallback(async () => {
    if (activeRef.current) await play(activeRef.current, allowPhoneRef.current);
  }, [play]);
  const resume = useCallback(async () => {
    if (!activeRef.current) return;
    if (
      ["finished", "stopped", "interrupted", "error"].includes(phaseRef.current) ||
      sourceRef.current?.audio.id !== activeRef.current.id
    ) {
      await replay();
      return;
    }
    const request = gate.current.next();
    const source = sourceRef.current;
    if (source?.local ? !localAllowed(source.audio) : !onlineRef.current) {
      setMessage("Connect and refresh to resume this announcement."); return;
    }
    const next = await refreshOutput();
    if (!gate.current.isCurrent(request)) return;
    if (
      preferences.requireSpeaker &&
      !allowPhoneRef.current &&
      !isExternal(next)
    ) {
      setMessage("Reconnect your bus speaker before resuming.");
      return;
    }
    try {
      if (!gate.current.isCurrent(request)) return;
      lockScreen(true, activeRef.current);
      player.play();
    } catch (failure) {
      if (gate.current.isCurrent(request)) setMessage(readableError(failure));
    }
  }, [refreshOutput, preferences.requireSpeaker, replay, player, lockScreen, localAllowed]);

  return (
    <PlaybackContext.Provider
      value={{
        active,
        playing: status.playing,
        phase,
        position: status.currentTime,
        duration: status.duration,
        local,
        output,
        message,
        play,
        pause,
        resume,
        stop,
        replay,
        refreshOutput,
        dismissMessage: () => setMessage(null),
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
}
export function usePlayback() {
  const context = useContext(PlaybackContext);
  if (!context) throw new Error("usePlayback must be inside PlaybackProvider");
  return context;
}
