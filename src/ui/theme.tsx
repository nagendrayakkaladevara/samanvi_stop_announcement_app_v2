import React, { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as SystemUI from "expo-system-ui";

export const lightColors = {
  background: "#F5F5F7",
  surface: "#FFFFFF",
  text: "#1D1D1F",
  muted: "#68686E",
  subtle: "#6E6E76",
  line: "#E7E7EB",
  red: "#C92335",
  redSoft: "#FCF0F2",
  green: "#23734D",
  greenSoft: "#EDF6F0",
  amber: "#875E18",
  amberSoft: "#FBF4E7",
  blue: "#345F8A",
  blueSoft: "#EDF3F9",
  onAccent: "#FFFFFF",
  switchTrack: "#C9C9CF",
  canvas: "#E9EAED",
};
export type Palette = typeof lightColors;
export const darkColors: Palette = {
  background: "#111315", surface: "#1D2024", text: "#F3F2EF", muted: "#B1B3BC", subtle: "#A0A4AF",
  line: "#363A41", red: "#FF7B88", redSoft: "#3A2229", green: "#80D6AA", greenSoft: "#1E352C",
  amber: "#E8BE73", amberSoft: "#372E1F", blue: "#94BFEA", blueSoft: "#213247",
  onAccent: "#211418", switchTrack: "#535963", canvas: "#0A0C0E",
};
export type ThemeMode = "light" | "dark" | "system";
type ThemeValue = { colors: Palette; mode: ThemeMode; dark: boolean; setMode: (mode: ThemeMode) => Promise<void> };
const ThemeContext = createContext<ThemeValue>({ colors: lightColors, mode: "light", dark: false, setMode: async () => {} });
const key = "samanvi.theme.v1";

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const scheme = useColorScheme();
  const dark = mode === "dark" || (mode === "system" && scheme === "dark");
  const colors = dark ? darkColors : lightColors;
  useEffect(() => {
    let active = true;
    void (Platform.OS === "web" ? Promise.resolve(globalThis.localStorage?.getItem(key)) : SecureStore.getItemAsync(key))
      .then((saved) => { if (active && (saved === "light" || saved === "dark" || saved === "system")) setModeState(saved); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") {
      Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
      void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
    } else if (typeof document !== "undefined") document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [mode, colors, dark]);
  const setMode = async (next: ThemeMode) => {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, next);
    else await SecureStore.setItemAsync(key, next);
    setModeState(next);
  };
  return <ThemeContext.Provider value={{ colors, dark, mode, setMode }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useTheme().colors;
export function useStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [colors, factory]);
}

export const layout = { gutter: 20, gap: 16, radius: 18, touch: 48 };
