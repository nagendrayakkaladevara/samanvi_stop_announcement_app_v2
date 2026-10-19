import React, { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { AccessibilityInfo, AppState, Image, Platform, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { Asset } from "expo-asset";
import * as SplashScreen from "expo-splash-screen";
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { busCutout, introDuration, introTiming as timing } from "./config";
import { Highway, Landscape } from "./highway";
import { busPose } from "./motion";

const icon = require("../../../assets/app-icon.png");
const logo = require("../../../assets/samv_logo.png");
const clamp = Extrapolation.CLAMP;

/** Lives above the navigator, so navigation/auth changes never replay the intro. */
export function LaunchIntro({ children, ready }: PropsWithChildren<{ ready: boolean }>) {
  const { colors, dark, ready: themeReady } = useTheme();
  const [prepared, setPrepared] = useState(false);
  const [reduced, setReduced] = useState(true); // No movement until the preference is known.
  const [source, setSource] = useState<ImageSourcePropType | null>(busCutout);
  const [finished, setFinished] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const clock = useSharedValue(0);
  const opacity = useSharedValue(1);
  const cinematic = Boolean(source) && !reduced;

  useEffect(() => {
    let active = true;
    // A bad/missing cutout fails closed to official branding, never a stock bus.
    const assets = Asset.loadAsync([icon, logo]).catch(() => undefined);
    const bus = typeof busCutout === "number"
      ? Asset.loadAsync(busCutout).catch(() => { if (active) setSource(null); })
      : Promise.resolve();
    const preference = Platform.OS === "web" && typeof window !== "undefined"
      ? Promise.resolve(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true)
      : AccessibilityInfo.isReduceMotionEnabled().catch(() => true);
    const timeout = setTimeout(() => { if (active) { setSource(null); setPrepared(true); } }, 1800);
    void Promise.all([assets, bus, preference]).then(([, , reduce]) => {
      if (active) { clearTimeout(timeout); setReduced(reduce); setPrepared(true); }
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduce) => {
      if (reduce) { setReduced(true); setFinished(true); }
    });
    const media = Platform.OS === "web" && typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : undefined;
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) { setReduced(true); setFinished(true); }
    };
    media?.addEventListener?.("change", onPreferenceChange);
    return () => {
      active = false;
      clearTimeout(timeout);
      subscription.remove();
      media?.removeEventListener?.("change", onPreferenceChange);
    };
  }, []);

  useEffect(() => {
    if (!prepared || !themeReady) return;
    // Defer one frame so the overlay is laid out before native splash removal.
    let timer: ReturnType<typeof setTimeout>;
    const frame = requestAnimationFrame(() => {
      if (Platform.OS !== "web") void SplashScreen.hideAsync().catch(() => undefined);
      const duration = introDuration(Boolean(source), reduced);
      clock.value = withTiming(duration, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
      timer = setTimeout(() => setFinished(true), duration);
    });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); cancelAnimation(clock); };
  }, [prepared, themeReady, source, reduced, clock]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      // Don't resume an old journey when returning from the background.
      if (state !== "active" && prepared) setFinished(true);
    });
    return () => subscription.remove();
  }, [prepared]);

  useEffect(() => {
    if (!finished || !ready || !themeReady) return;
    opacity.value = withTiming(0, { duration: reduced ? 100 : timing.exit });
    const timer = setTimeout(() => setDismissed(true), reduced ? 100 : timing.exit);
    return () => clearTimeout(timer);
  }, [finished, ready, themeReady, reduced, opacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: cinematic ? interpolate(clock.value, [0, 90, 300, 510], [0, 1, 1, 0], clamp) : 0,
    transform: [{ scale: cinematic ? interpolate(clock.value, [0, 300, 600], [0.94, 1, 1.055], clamp) : 1 }],
  }));
  const environmentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clock.value, [600, 900, 1700, 2010], [0, 1, 1, 0], clamp),
    transform: [{ scale: interpolate(clock.value, [600, 1700], [1.035, 1], clamp) }],
  }));
  const roadStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clock.value, [300, 600, 1700, 1950], [0, 1, 1, 0], clamp),
    transform: [{ translateY: interpolate(clock.value, [300, 650], [100, 0], clamp) }, { scale: interpolate(clock.value, [300, 1300, 1750], [1.12, 1.045, 1], clamp) }],
  }));
  const trailStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clock.value, [350, 650, 1800, 2130], [0, 1, 0.8, 0], clamp),
    transform: [
      { translateY: interpolate(clock.value, [1700, 2100], [0, -70], clamp) },
      { scale: interpolate(clock.value, [1700, 2130], [1, 0.25], clamp) },
    ],
  }));
  const busStyle = useAnimatedStyle(() => {
    const pose = busPose(clock.value);
    return {
      opacity: interpolate(clock.value, [900, 1000, 1690, 1860], [0, 1, 1, 0], clamp),
      transform: [
        { perspective: 1000 },
        { translateX: pose.x },
        { translateY: pose.y },
        { scale: pose.scale },
        { rotateZ: `${pose.roll}deg` },
        { rotateY: `${pose.yaw}deg` },
      ],
    };
  });
  const logoStyle = useAnimatedStyle(() => ({
    opacity: cinematic ? interpolate(clock.value, [1960, 2220], [0, 1], clamp) : 1,
    transform: [{ scale: cinematic ? interpolate(clock.value, [1960, 2300], [0.97, 1], clamp) : 1 }],
  }));
  const failBus = useCallback(() => setSource(null), []);

  return (
    <View style={styles.root}>
      <View style={styles.root} accessibilityElementsHidden={!dismissed} importantForAccessibility={dismissed ? "auto" : "no-hide-descendants"}>
        {children}
      </View>
      {!dismissed && <Animated.View
        testID="launch-intro"
        accessible accessibilityRole="image" accessibilityLabel="Samanvi Travels"
        style={[styles.overlay, { backgroundColor: colors.background }, overlayStyle]}
      >
        {cinematic && <>
          <Animated.View style={[StyleSheet.absoluteFill, environmentStyle]}><Landscape dark={dark} /></Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, roadStyle]}><Highway dark={dark} /></Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, trailStyle]}><Highway dark={dark} trailsOnly /></Animated.View>
          <View style={styles.busFrame} pointerEvents="none">
            <Animated.View style={[styles.bus, busStyle]}>
              <View style={[styles.shadow, { backgroundColor: dark ? "#000000" : "#17212B" }]} />
              {source && <Image source={source} resizeMode="contain" style={styles.busImage} onError={failBus} fadeDuration={0} />}
            </Animated.View>
          </View>
        </>}
        <Animated.View style={[styles.brandCenter, iconStyle]} pointerEvents="none">
          <Image source={icon} style={styles.icon} fadeDuration={0} />
        </Animated.View>
        <Animated.View style={[styles.brandCenter, logoStyle]} pointerEvents="none">
          <Image source={logo} style={styles.logo} resizeMode="contain" fadeDuration={0} />
        </Animated.View>
      </Animated.View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, overflow: "hidden", zIndex: 100 },
  brandCenter: { ...StyleSheet.absoluteFill, justifyContent: "center", alignItems: "center" },
  icon: { width: 160, height: 160 },
  logo: { width: "66%", maxWidth: 290, height: 76 },
  busFrame: { position: "absolute", top: "47%", left: "5%", width: "90%", aspectRatio: 1.45 },
  bus: { flex: 1 },
  busImage: { width: "100%", height: "100%" },
  shadow: { position: "absolute", bottom: "3%", left: "12%", width: "78%", height: "8%", borderRadius: 100, opacity: 0.25, filter: [{ blur: 9 }] },
});
