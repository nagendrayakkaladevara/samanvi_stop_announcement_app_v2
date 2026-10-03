import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LibraryProvider } from "../state/library";
import { PlaybackProvider } from "../state/playback";
import { colors } from "../ui/theme";

export { ErrorBoundary } from "expo-router";
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#E9EAED" }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: Platform.OS === "web" ? 480 : undefined,
            alignSelf: "center",
          }}
        >
          <LibraryProvider>
            <PlaybackProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="player"
                  options={{ presentation: "modal" }}
                />
              </Stack>
            </PlaybackProvider>
          </LibraryProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
