import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import AudioRoute from "../../modules/samanvi-audio-route";
import { isReady, readableError, type AudioAsset } from "../domain/catalog";
import {
  isExternal,
  outputWasLost,
  PlaybackGate,
  type Output,
} from "../domain/playback-gate";
import { fileExists } from "../services/storage";
import type { PlaybackPhase } from "../domain/presentation";
import { useLibrary } from "./library";

const unknownOutput: Output = {
  kind: "unknown",
  name: "Check on your phone",
  supported: false,
};
type Phase = PlaybackPhase;
type PlaybackContextValue = {
  active: AudioAsset | null;
  playing: boolean;
  phase: Phase;
  position: number;
  duration: number;
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
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const { snapshot, preferences } = useLibrary();
  const [active, setActive] = useState<AudioAsset | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<Output>(unknownOutput);
  const outputRef = useRef(output);
  const activeRef = useRef<AudioAsset | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const gate = useRef(new PlaybackGate());
  const allowPhoneRef = useRef(false);

  const transition = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const lockScreen = useCallback(
    (enabled: boolean, audio?: AudioAsset) => {
      if (Platform.OS !== "web")
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
        transition("error");
        setMessage(
          "This audio could not be played. Open your library and check its download.",
        );
        lockScreen(false);
      } else if (next.didJustFinish) {
        transition("finished");
        lockScreen(false);
      } else if (next.playing) transition("playing");
      else if (phaseRef.current === "playing" && !next.isBuffering)
        transition("paused");
    });
    return () => subscription.remove();
  }, [player, lockScreen, transition]);

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
        const file = snapshot?.files[audio.id];
        if (!file || !isReady(snapshot, audio) || !fileExists(file))
          throw new Error(
            "This announcement is not saved on this phone. Open Audio library and download it before playing.",
          );
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
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldPlayInBackground: true,
          interruptionMode: "doNotMix",
        });
        if (!gate.current.isCurrent(request)) return false;
        player.pause();
        player.replace({ uri: file.uri });
        activeRef.current = audio;
        setActive(audio);
        allowPhoneRef.current = allowPhone;
        transition("loading");
        lockScreen(true, audio);
        player.play();
        return true;
      } catch (failure) {
        if (gate.current.isCurrent(request)) {
          setMessage(readableError(failure));
        }
        return false;
      }
    },
    [
      snapshot,
      preferences.requireSpeaker,
      refreshOutput,
      player,
      transition,
      lockScreen,
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
      ["finished", "stopped", "interrupted", "error"].includes(phaseRef.current)
    ) {
      await replay();
      return;
    }
    const request = gate.current.next();
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
      lockScreen(true, activeRef.current);
      player.play();
    } catch (failure) {
      setMessage(readableError(failure));
    }
  }, [refreshOutput, preferences.requireSpeaker, replay, player, lockScreen]);

  return (
    <PlaybackContext.Provider
      value={{
        active,
        playing: status.playing,
        phase,
        position: status.currentTime,
        duration: status.duration,
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
