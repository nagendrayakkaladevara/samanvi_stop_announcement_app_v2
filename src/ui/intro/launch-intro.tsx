import React, { useCallback, useState, type PropsWithChildren } from "react";
import { Image, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue } from "react-native-reanimated";
import { useTheme } from "../theme";
import { busAspectRatio, introIcon, introLogo } from "./assets";
import { BusContact, Highway, Landscape, RoadTrails } from "./highway";
import { busPose, sceneFrame } from "./motion";
import { useLaunchSequence } from "./use-launch-sequence";

/** One continuous shot above the existing navigator; never a navigation route. */
export function LaunchIntro({ children, ready }: PropsWithChildren<{ ready: boolean }>) {
  const { colors, dark, ready: themeReady } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setSize(previous => previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height });
  }, []);
  const { clock, opacity, source, cinematic, started, dismissed, imageLoaded, failBus } = useLaunchSequence(themeReady, size.width > 0 && size.height > 0, ready);
  const frame = useDerivedValue(() => sceneFrame(clock.value));
  const busWidth = size.width * 0.82;
  const busHeight = busWidth / busAspectRatio;
  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: !started ? 1 : cinematic ? frame.value.iconOpacity : 0,
    transform: [{ scale: started && cinematic ? frame.value.iconScale : 1 }],
  }));
  const environmentStyle = useAnimatedStyle(() => ({
    opacity: frame.value.environment,
    transform: [{ scale: frame.value.distantScale }],
  }));
  const cameraStyle = useAnimatedStyle(() => ({ transform: [{ scale: frame.value.cameraScale }] }));
  const roadStyle = useAnimatedStyle(() => ({ opacity: frame.value.road }));
  const busStyle = useAnimatedStyle(() => {
    const pose = busPose(clock.value);
    return {
      opacity: frame.value.busOpacity,
      transform: [
        { translateX: pose.x * size.width / 400 - busWidth * 0.508 },
        { translateY: pose.y * size.height / 860 - busHeight * 0.985 },
        { perspective: 1200 },
        { scale: pose.scale },
        { rotateZ: `${pose.roll}deg` },
        { rotateY: `${pose.yaw}deg` },
      ],
    };
  });
  const logoStyle = useAnimatedStyle(() => ({
    opacity: !started ? 0 : cinematic ? frame.value.logoOpacity : 1,
    transform: [{ scale: cinematic ? frame.value.logoScale : 1 }],
  }));

  return <View style={styles.root} onLayout={onLayout}>
    <View style={styles.root} pointerEvents={dismissed ? "auto" : "none"} accessibilityElementsHidden={!dismissed} importantForAccessibility={dismissed ? "auto" : "no-hide-descendants"}>
      {children}
    </View>
    {!dismissed && <Animated.View
      testID="launch-intro" accessible accessibilityRole="image" accessibilityLabel="Samanvi Travels"
      style={[styles.overlay, { backgroundColor: colors.background }, overlayStyle]}
    >
      {cinematic && <>
        <Animated.View testID="intro-environment" style={[StyleSheet.absoluteFill, environmentStyle]}><Landscape dark={dark} /></Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, cameraStyle]} pointerEvents="none">
          <Animated.View testID="intro-road" style={[StyleSheet.absoluteFill, roadStyle]}><Highway dark={dark} /></Animated.View>
          <RoadTrails dark={dark} frame={frame} />
          <Animated.View testID="intro-bus" style={[styles.bus, { width: busWidth, height: busHeight }, busStyle]}>
            <BusContact dark={dark} />
            {source && <Image source={source} resizeMode="contain" style={styles.busImage} onLoad={() => imageLoaded(4)} onError={failBus} fadeDuration={0} />}
          </Animated.View>
        </Animated.View>
      </>}
      <Animated.View testID="intro-icon" style={[styles.brandCenter, iconStyle]} pointerEvents="none">
        <Image source={introIcon} style={styles.icon} onLoadEnd={() => imageLoaded(1)} fadeDuration={0} />
      </Animated.View>
      <Animated.View testID="intro-logo" style={[styles.brandCenter, logoStyle]} pointerEvents="none">
        <Image source={introLogo} style={styles.logo} resizeMode="contain" onLoadEnd={() => imageLoaded(2)} fadeDuration={0} />
      </Animated.View>
    </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, overflow: "hidden", zIndex: 100 },
  brandCenter: { ...StyleSheet.absoluteFill, justifyContent: "center", alignItems: "center" },
  icon: { width: 160, height: 160 },
  logo: { width: "64%", maxWidth: 280, aspectRatio: 400 / 98 },
  bus: { position: "absolute", top: 0, left: 0, transformOrigin: "50.8% 98.5%" },
  busImage: { width: "100%", height: "100%" },
});
