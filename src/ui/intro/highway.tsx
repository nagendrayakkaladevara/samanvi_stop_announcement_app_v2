import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, { useAnimatedProps, type DerivedValue } from "react-native-reanimated";
import type { sceneFrame } from "./motion";

const AnimatedPath = Animated.createAnimatedComponent(Path);
type Frame = DerivedValue<ReturnType<typeof sceneFrame>>;
const canvas = { ...StyleSheet.absoluteFill, width: "100%", height: "100%" } as const;

const roadSilhouette = "M-230 940 C-160 770 300 734 206 642 C85 580 48 540 158 464 C191 435 238 440 244 418 L246 418 C244 448 220 452 184 480 C135 530 215 570 294 608 C500 735 180 810 140 940 Z";
const nearEdge = "M-230 940 C-160 770 300 734 206 642 C85 580 48 540 158 464 C191 435 238 440 244 418";
const farEdge = "M140 940 C180 810 500 735 294 608 C215 570 135 530 184 480 C220 452 244 448 246 418";

/** Tonal, curved silhouettes and atmospheric falloff keep attention on the photo. */
export function Landscape({ dark }: { dark: boolean }) {
  return (
    <Svg width="100%" height="100%" style={canvas} viewBox="0 0 400 860" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="intro-sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor={dark ? "#101419" : "#F3F4F6"} />
          <Stop offset="0.47" stopColor={dark ? "#1B2938" : "#E7EDF1"} />
          <Stop offset="1" stopColor={dark ? "#0D141B" : "#C8D1D0"} />
        </LinearGradient>
        <RadialGradient id="intro-daybreak">
          <Stop offset="0" stopColor={dark ? "#7F9DB4" : "#FFF1DA"} stopOpacity={dark ? 0.17 : 0.8} />
          <Stop offset="0.45" stopColor={dark ? "#7F9DB4" : "#FFF1DA"} stopOpacity={dark ? 0.06 : 0.3} />
          <Stop offset="1" stopColor={dark ? "#7F9DB4" : "#FFF1DA"} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="intro-hills" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor={dark ? "#26343F" : "#BAC8C8"} stopOpacity="0.5" />
          <Stop offset="1" stopColor={dark ? "#152029" : "#CBD3D2"} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="intro-ground" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor={dark ? "#142028" : "#B3C2BB"} stopOpacity="0.15" />
          <Stop offset="0.3" stopColor={dark ? "#101A22" : "#9BAFA7"} stopOpacity="0.7" />
          <Stop offset="1" stopColor={dark ? "#0B1117" : "#748B83"} />
        </LinearGradient>
        <RadialGradient id="intro-vignette">
          <Stop offset="0.3" stopColor={dark ? "#080D12" : "#F5F5F7"} stopOpacity="0" />
          <Stop offset="1" stopColor={dark ? "#080D12" : "#F5F5F7"} stopOpacity={dark ? 0.48 : 0.32} />
        </RadialGradient>
      </Defs>
      <Rect width="400" height="860" fill="url(#intro-sky)" />
      <Ellipse cx="270" cy="390" rx="300" ry="230" fill="url(#intro-daybreak)" />
      <Path d="M-40 438 C12 432 34 400 74 405 S143 450 198 428 S271 385 318 407 S388 425 440 397 V630 H-40Z" fill="url(#intro-hills)" />
      <Path d="M-40 490 C45 444 81 474 138 467 S228 442 285 460 S363 441 440 455 V680 H-40Z" fill="url(#intro-hills)" opacity="0.6" />
      <Rect y="445" width="400" height="415" fill="url(#intro-ground)" />
      <Rect width="400" height="860" fill="url(#intro-vignette)" />
    </Svg>
  );
}

/** Asphalt and reflections are separate from the single pair of animated trails. */
export function Highway({ dark }: { dark: boolean }) {
  return (
    <Svg width="100%" height="100%" style={canvas} viewBox="0 0 400 860" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="intro-asphalt" x1="0%" y1="0%" x2="80%" y2="100%">
          <Stop offset="0" stopColor={dark ? "#243442" : "#BAC4C8"} stopOpacity="0.1" />
          <Stop offset="0.32" stopColor={dark ? "#263744" : "#A5B0B6"} stopOpacity="0.9" />
          <Stop offset="0.64" stopColor={dark ? "#172431" : "#7C8C98"} />
          <Stop offset="1" stopColor={dark ? "#0E1923" : "#62737E"} />
        </LinearGradient>
        <LinearGradient id="intro-edge" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor={dark ? "#95A6B2" : "#FAFCFE"} stopOpacity="0" />
          <Stop offset="0.35" stopColor={dark ? "#95A6B2" : "#FAFCFE"} stopOpacity="0.25" />
          <Stop offset="1" stopColor={dark ? "#95A6B2" : "#FAFCFE"} stopOpacity="0.55" />
        </LinearGradient>
        <RadialGradient id="intro-road-sheen">
          <Stop offset="0" stopColor={dark ? "#B3CCDA" : "#FFFAED"} stopOpacity={dark ? 0.12 : 0.3} />
          <Stop offset="1" stopColor={dark ? "#B3CCDA" : "#FFFAED"} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Path d={roadSilhouette} fill="url(#intro-asphalt)" />
      <G fill="none" stroke="url(#intro-edge)">
        <Path d={nearEdge} strokeWidth="0.8" />
        <Path d={farEdge} strokeWidth="1.1" />
      </G>
      <Ellipse cx="228" cy="625" rx="100" ry="24" fill="url(#intro-road-sheen)" transform="rotate(17 228 625)" />
    </Svg>
  );
}

/** Interpolate the road into a short light sweep at the logo's optical centre.
 * All control points move continuously; the whole road never shrinks like a card.
 */
function lightPath(offset: number, morph: number) {
  "worklet";
  const mix = (a: number, b: number) => a + (b - a) * morph;
  return `M${mix(-60 + offset, 90)} ${mix(940, 480 + offset * 0.1)} C${mix(-40 + offset, 112)} ${mix(785, 469)} ${mix(400 + offset * 0.6, 166)} ${mix(735, 462)} ${mix(250 + offset * 0.35, 210)} ${mix(625, 456)} C${mix(160 + offset * 0.25, 250)} ${mix(560, 449)} ${mix(100 + offset * 0.12, 260)} ${mix(540, 440)} ${mix(170 + offset * 0.07, 238)} ${mix(470, 434)} C${mix(205, 226)} ${mix(435, 431)} ${mix(241, 212)} ${mix(440, 430)} ${mix(244, 200)} ${mix(418, 430)}`;
}

function LightRibbon({ frame, offset, color, dark }: { frame: Frame; offset: number; color: string; dark: boolean }) {
  const props = useAnimatedProps(() => ({
    d: lightPath(offset, frame.value.trailConvergence),
    strokeDashoffset: 1400 * (1 - frame.value.trailReveal),
    opacity: frame.value.trailOpacity,
  }));
  return <G fill="none" strokeLinecap="round" strokeDasharray="1400 1400">
    <G opacity={dark ? 0.055 : 0.04}><AnimatedPath animatedProps={props} stroke={color} strokeWidth="15" /></G>
    <G opacity={dark ? 0.16 : 0.12}><AnimatedPath animatedProps={props} stroke={color} strokeWidth="5" /></G>
    <G opacity={dark ? 0.85 : 0.65}><AnimatedPath animatedProps={props} stroke={color} strokeWidth="1.25" /></G>
    <G opacity={dark ? 0.7 : 0.4}><AnimatedPath animatedProps={props} stroke={offset < 0 ? "#D9EEFF" : "#FFE2E7"} strokeWidth="0.4" /></G>
  </G>;
}

export function RoadTrails({ dark, frame }: { dark: boolean; frame: Frame }) {
  return <Svg width="100%" height="100%" style={canvas} viewBox="0 0 400 860" preserveAspectRatio="none">
    <LightRibbon frame={frame} offset={-22} color="#348AFF" dark={dark} />
    <LightRibbon frame={frame} offset={20} color="#F04458" dark={dark} />
  </Svg>;
}

/** Soft falloff instead of platform-specific blur filters; matches the photo's tyres. */
export function BusContact({ dark }: { dark: boolean }) {
  return <Svg width="100%" height="100%" style={canvas} viewBox="0 0 817 459" preserveAspectRatio="none">
    <Defs>
      <RadialGradient id="intro-contact">
        <Stop offset="0" stopColor="#03080D" stopOpacity={dark ? 0.65 : 0.38} />
        <Stop offset="0.45" stopColor="#03080D" stopOpacity={dark ? 0.3 : 0.2} />
        <Stop offset="1" stopColor="#03080D" stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id="intro-lamp-pool">
        <Stop offset="0" stopColor="#EDF4DE" stopOpacity={dark ? 0.16 : 0.08} />
        <Stop offset="1" stopColor="#EDF4DE" stopOpacity="0" />
      </RadialGradient>
    </Defs>
    <Ellipse cx="430" cy="414" rx="310" ry="34" fill="url(#intro-contact)" transform="rotate(12 430 414)" />
    <Ellipse cx="137" cy="379" rx="36" ry="9" fill="url(#intro-contact)" />
    <Ellipse cx="416" cy="452" rx="40" ry="7" fill="url(#intro-contact)" />
    <Ellipse cx="680" cy="442" rx="91" ry="12" fill="url(#intro-lamp-pool)" />
  </Svg>;
}
