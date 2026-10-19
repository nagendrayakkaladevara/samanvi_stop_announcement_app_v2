import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Platform, type ImageSourcePropType } from "react-native";
import { Asset } from "expo-asset";
import * as SplashScreen from "expo-splash-screen";
import { cancelAnimation, Easing, ReduceMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { busCutout, introIcon, introLogo } from "./assets";
import { introDuration, introTiming as timing } from "./config";

export function useLaunchSequence(themeReady: boolean, layoutReady: boolean, appReady: boolean) {
  const [prepared, setPrepared] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [decoded, setDecoded] = useState(0);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [source, setSource] = useState<ImageSourcePropType | null>(busCutout);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const clock = useSharedValue(0);
  const opacity = useSharedValue(1);
  const mounted = useRef(true);
  const hasStarted = useRef(false);
  const forceStatic = useRef(false);
  const cinematic = reduced === false && Boolean(source);
  const finish = useCallback(() => { if (mounted.current) setFinished(true); }, []);
  const dismiss = useCallback(() => { if (mounted.current) setDismissed(true); }, []);
  const interrupt = useCallback(() => {
    if (!hasStarted.current) return;
    cancelAnimation(clock);
    clock.set(timing.end);
    finish();
  }, [clock, finish]);
  const imageLoaded = useCallback((bit: number) => setDecoded(previous => previous | bit), []);
  const failBus = useCallback(() => { setSource(null); interrupt(); }, [interrupt]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimation(clock);
      cancelAnimation(opacity);
    };
  }, [clock, opacity]);

  useEffect(() => {
    let active = true;
    let settled = false;
    const brand = Asset.loadAsync([introIcon, introLogo]).catch(() => undefined);
    // Metro supplies module IDs on native and URI descriptors on web.
    const busModule = typeof busCutout === "number" ? busCutout : !Array.isArray(busCutout) ? busCutout.uri : undefined;
    const bus = busModule ? Asset.loadAsync(busModule).then(() => true, () => false) : Promise.resolve(false);
    const preference = Platform.OS === "web" && typeof window !== "undefined"
      ? Promise.resolve(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true)
      : AccessibilityInfo.isReduceMotionEnabled().catch(() => true);
    const timeout = setTimeout(() => {
      if (!active || hasStarted.current) return;
      settled = true;
      setSource(null);
      setReduced(true);
      setTimedOut(true);
      setPrepared(true);
    }, 1800);
    void Promise.all([brand, bus, preference]).then(([, busReady, reduce]) => {
      if (!active || settled) return;
      settled = true;
      if (!busReady) setSource(null);
      setReduced(reduce || forceStatic.current);
      setPrepared(true);
      // Keep the deadline until decoded image surfaces are ready as well.
    });
    return () => { active = false; clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (dismissed) return;
    const reduceMotion = () => {
      forceStatic.current = true;
      setReduced(true);
      interrupt();
    };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", reduce => { if (reduce) reduceMotion(); });
    const media = Platform.OS === "web" && typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : undefined;
    const onPreferenceChange = (event: MediaQueryListEvent) => { if (event.matches) reduceMotion(); };
    media?.addEventListener?.("change", onPreferenceChange);
    const appState = AppState.addEventListener("change", state => {
      // An iOS 'inactive' notification can occur during launch; only background
      // ends the journey. Returning never resumes an old half-finished shot.
      if (state === "background") reduceMotion();
    });
    return () => {
      subscription.remove();
      media?.removeEventListener?.("change", onPreferenceChange);
      appState.remove();
    };
  }, [dismissed, interrupt]);

  useEffect(() => {
    if (!prepared || !themeReady || !layoutReady || hasStarted.current) return;
    const imagesReady = (decoded & 3) === 3 && (!cinematic || (decoded & 4) === 4);
    if (!imagesReady && !timedOut) return;
    const frame = requestAnimationFrame(() => {
      hasStarted.current = true;
      setStarted(true);
      // The native icon hands off to an already-decoded, same-size icon.
      if (Platform.OS !== "web") void SplashScreen.hideAsync().catch(() => undefined);
      if (cinematic && !imagesReady) { setSource(null); setReduced(true); }
      const duration = introDuration(cinematic && imagesReady, reduced === true);
      clock.set(withTiming(duration, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never }, complete => {
        if (complete) scheduleOnRN(finish);
      }));
    });
    return () => cancelAnimationFrame(frame);
  }, [prepared, themeReady, layoutReady, decoded, cinematic, timedOut, reduced, clock, finish]);

  useEffect(() => {
    if (!finished || !appReady || !themeReady) return;
    // Remove only after the UI-thread fade finishes, never on an unrelated JS timer.
    opacity.set(withTiming(0, {
      duration: reduced ? 100 : timing.exit,
      easing: Easing.bezier(0.22, 0.61, 0.36, 1),
      reduceMotion: ReduceMotion.Never,
    }, complete => { if (complete) scheduleOnRN(dismiss); }));
    return () => cancelAnimation(opacity);
  }, [finished, appReady, themeReady, reduced, opacity, dismiss]);

  return { clock, opacity, source, cinematic, started, dismissed, imageLoaded, failBus };
}
