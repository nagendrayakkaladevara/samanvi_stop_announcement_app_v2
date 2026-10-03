import { ActivityIndicator, Platform, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../state/auth";
import { LibraryProvider } from "../state/library";
import { PlaybackProvider } from "../state/playback";
import { isDemo } from "../services/api";
import { colors } from "../ui/theme";

export { ErrorBoundary } from "expo-router";

function Navigator() {
  const { session, loading } = useAuth();
  const authenticated = isDemo || Boolean(session);
  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}><ActivityIndicator color={colors.red} /></View>;

  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!authenticated}><Stack.Screen name="login" /></Stack.Protected>
      <Stack.Protected guard={authenticated}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="routes" />
        <Stack.Screen name="library" />
        <Stack.Screen name="speaker" />
        <Stack.Screen name="help" />
        <Stack.Screen name="player" options={{ presentation: "modal" }} />
      </Stack.Protected>
    </Stack>
  );
  return authenticated ? <LibraryProvider><PlaybackProvider>{stack}</PlaybackProvider></LibraryProvider> : stack;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#E9EAED" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: Platform.OS === "web" ? 480 : undefined, alignSelf: "center" }}>
          <AuthProvider><StatusBar style="dark" /><Navigator /></AuthProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
