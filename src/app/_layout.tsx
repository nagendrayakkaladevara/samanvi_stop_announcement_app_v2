import { Platform, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../state/auth";
import { LibraryProvider } from "../state/library";
import { PlaybackProvider } from "../state/playback";
import { ThemeProvider, useColors, useTheme } from "../ui/theme";
import { LoadingState } from "../ui/components";

export { ErrorBoundary } from "expo-router";

function Navigator() {
  const colors = useColors();
  const { session, loading } = useAuth();
  const authenticated = Boolean(session);
  if (loading) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.background }}><LoadingState label="Opening Samanvi Driver" /></View>;

  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!authenticated}><Stack.Screen name="login" /></Stack.Protected>
      <Stack.Protected guard={authenticated}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="route-announcements" />
        <Stack.Screen name="welcome-notes" />
        <Stack.Screen name="library" />
        <Stack.Screen name="speaker" />
        <Stack.Screen name="help" />
        <Stack.Screen name="player" options={{ presentation: "modal" }} />
      </Stack.Protected>
    </Stack>
  );
  return authenticated ? <LibraryProvider key={session!.user.id}><PlaybackProvider>{stack}</PlaybackProvider></LibraryProvider> : stack;
}

function ThemedRoot() {
  const { colors, dark } = useTheme();
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flex: 1, width: "100%", maxWidth: Platform.OS === "web" ? 480 : undefined, alignSelf: "center" }}>
          <AuthProvider><StatusBar style={dark ? "light" : "dark"} /><Navigator /></AuthProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
export default function RootLayout() {
  return <ThemeProvider><ThemedRoot /></ThemeProvider>;
}
