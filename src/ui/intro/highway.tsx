import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

export const highwayCurve = "M 65 920 C -50 770 450 700 210 590 C 110 545 68 498 202 438 C 223 420 240 407 244 390";
const roadSilhouette = "M -60 920 C -150 760 390 715 175 610 C 50 562 41 505 196 433 C 221 414 238 405 244 390 L 246 390 C 243 413 232 430 213 445 C 118 493 135 521 245 570 C 550 715 100 800 215 920 Z";

function trailCurve(offset: number) {
  return `M ${65 + offset} 920 C ${-50 + offset} 770 ${450 + offset * 0.6} 700 ${210 + offset * 0.35} 590 C ${110 + offset * 0.25} 545 ${68 + offset * 0.12} 498 ${202 + offset * 0.07} 438 C 223 420 240 407 244 390`;
}

/** Static vector layers: only their enclosing native views animate per frame. */
export function Landscape({ dark }: { dark: boolean }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 860" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={dark ? "#040C19" : "#DCE9F4"} />
          <Stop offset="0.52" stopColor={dark ? "#14233C" : "#FFE4CD"} />
          <Stop offset="1" stopColor={dark ? "#060D14" : "#A0B4B6"} />
        </LinearGradient>
        <RadialGradient id="sunrise">
          <Stop offset="0" stopColor={dark ? "#799DC9" : "#FFF5D7"} stopOpacity={dark ? 0.12 : 0.85} />
          <Stop offset="1" stopColor={dark ? "#799DC9" : "#FFF5D7"} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="land" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={dark ? "#0E1C24" : "#748A79"} />
          <Stop offset="1" stopColor={dark ? "#03090E" : "#344E48"} />
        </LinearGradient>
      </Defs>
      <Rect width="400" height="860" fill="url(#sky)" />
      <Ellipse cx="300" cy="365" rx="280" ry="220" fill="url(#sunrise)" />
      {!dark && <Circle cx="306" cy="360" r="17" fill="#FFF7DE" opacity="0.85" />}
      <Path d="M0 421 L48 370 92 403 156 349 213 398 268 367 327 402 370 365 400 398 V860 H0Z" fill={dark ? "#162538" : "#ACB0B4"} />
      <Path d="M0 453 L43 411 105 444 175 397 238 437 305 408 361 432 400 405 V860 H0Z" fill={dark ? "#0C1926" : "#83958F"} />
      <G fill={dark ? "#0B1623" : "#9BAAB2"}>
        {[18, 44, 68, 102, 129, 158, 336, 361, 382].map((x, i) => (
          <Rect key={x} x={x} y={410 - (i % 4) * 13} width={12 + (i % 3) * 3} height={58 + (i % 4) * 13} />
        ))}
      </G>
      {dark && <G fill="#F7C791" opacity="0.55">
        {Array.from({ length: 36 }, (_, i) => <Rect key={i} x={21 + (i % 9) * 15 + (i % 2) * 2} y={415 + Math.floor(i / 9) * 9} width="2" height="3" />)}
      </G>}
      <Path d="M0 475 Q80 442 158 473 T400 450 V860 H0Z" fill="url(#land)" />
    </Svg>
  );
}

export function Highway({ dark, trailsOnly = false }: { dark: boolean; trailsOnly?: boolean }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 860" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={dark ? "#1D2B3C" : "#899398"} />
          <Stop offset="1" stopColor={dark ? "#111C2C" : "#4B5964"} />
        </LinearGradient>
      </Defs>
      {!trailsOnly && <G fill="none">
        <Path d={roadSilhouette} fill="url(#asphalt)" stroke={dark ? "#344451" : "#C5CCCE"} strokeWidth="2" />
        <Path d={highwayCurve} stroke={dark ? "#9CABB9" : "#DCE1E4"} strokeWidth="1.2" strokeDasharray="16 24" opacity="0.48" />
      </G>}
      <G fill="none" strokeLinecap="round">
        {[{ color: "#0075FF", x: -21 }, { color: "#35BFFF", x: -13 }, { color: "#EF304B", x: 23 }].map(({ color, x }) => (
          <G key={color}>
            <Path d={trailCurve(x)} stroke={color} strokeWidth="22" opacity={dark ? 0.05 : 0.035} />
            <Path d={trailCurve(x)} stroke={color} strokeWidth="10" opacity="0.12" />
            <Path d={trailCurve(x)} stroke={color} strokeWidth="3" opacity="0.9" />
            <Path d={trailCurve(x)} stroke={x === 23 ? "#FFD3DA" : "#D4F5FF"} strokeWidth="0.9" opacity="0.85" />
          </G>
        ))}
      </G>
    </Svg>
  );
}
