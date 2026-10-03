import { View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Label,
  EmptyState,
  Screen,
  StatusPill,
} from "../../ui/components";
import { colors } from "../../ui/theme";

export default function Records() {
  return (
    <Screen title="Records" kicker="Your announcement history">
      <EmptyState
        icon="clock"
        title="History is on its way"
        description="A record of your route announcements will be available in a future update."
      />
      <View style={{ alignItems: "center" }}>
        <StatusPill label="Coming soon" />
      </View>
      <Label
        style={{
          color: colors.muted,
          textAlign: "center",
          fontSize: 14,
          marginVertical: 16,
        }}
      >
        No playback history is recorded in this version.
      </Label>
      <Button
        title="Go to route audio"
        variant="secondary"
        icon="map"
        onPress={() => router.navigate("/(tabs)/announcements")}
      />
    </Screen>
  );
}
