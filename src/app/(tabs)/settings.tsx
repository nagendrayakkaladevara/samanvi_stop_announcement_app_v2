import { Platform, Pressable, Switch, View } from "react-native";
import { router } from "expo-router";
import {
  Card,
  Icon,
  Label,
  Screen,
  SectionTitle,
  Notice,
  type IconName,
} from "../../ui/components";
import { useLibrary } from "../../state/library";
import { colors as c } from "../../ui/theme";
import { useAuth } from "../../state/auth";
import { confirmAction } from "../../ui/components";

function Row({
  icon,
  title,
  onPress,
}: {
  icon: IconName;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{
        minHeight: 64,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 15,
      }}
    >
      <Icon name={icon} color={c.muted} size={20} />
      <Label style={{ flex: 1, fontSize: 14 }}>{title}</Label>
      <Icon name="chevron-right" size={18} color={c.subtle} />
    </Pressable>
  );
}
export default function Settings() {
  const { preferences, setPreference } = useLibrary();
  const auth = useAuth();
  return (
    <Screen title="Settings" kicker="Preferences & support">
      <Card
        style={{
          padding: 20,
          flexDirection: "row",
          gap: 16,
          alignItems: "center",
        }}
      >
        <View
          style={{
            backgroundColor: c.redSoft,
            width: 50,
            height: 50,
            borderRadius: 25,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Label style={{ color: c.red, fontWeight: "700" }}>ST</Label>
        </View>
        <View style={{ gap: 5, flex: 1 }}>
          <Label style={{ fontWeight: "600" }}>{auth.session?.user.displayName ?? "Samanvi driver"}</Label>
          <Label style={{ fontSize: 13, color: c.muted }}>
            Published announcement library
          </Label>
        </View>
      </Card>
      <SectionTitle>Audio</SectionTitle>
      <Card>
        <Row
          icon="bluetooth"
          title="Bus speaker"
          onPress={() => router.push("/speaker")}
        />
        <View style={{ height: 1, marginLeft: 55, backgroundColor: c.line }} />
        <Row
          icon="headphones"
          title="Audio library"
          onPress={() => router.push("/library")}
        />
      </Card>
      <Card>
          <Row
            icon="log-out"
            title="Sign out"
            onPress={() => confirmAction("Sign out?", "You will need your username and password to use the app again.", () => void auth.signOut(), "Sign out")}
          />
      </Card>
      <SectionTitle>Preferences</SectionTitle>
      <Card style={{ padding: 18, gap: 20 }}>
        {(
          [
            {
              key: "keepAwake",
              title: "Keep screen awake",
              copy: "Only while audio is playing",
            },
            {
              key: "requireSpeaker",
              title: "Require a bus speaker",
              copy: "Check output before playback",
            },
          ] as const
        ).map((item) => (
          <View
            key={item.key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              minHeight: 56,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Label style={{ fontSize: 14, fontWeight: "500" }}>
                {item.title}
              </Label>
              <Label style={{ fontSize: 13, color: c.muted }}>
                {item.copy}
              </Label>
            </View>
            <Switch
              accessibilityLabel={item.title}
              accessibilityHint={item.copy}
              hitSlop={12}
              value={preferences[item.key]}
              onValueChange={(value) => void setPreference(item.key, value)}
              trackColor={{ false: "#C9C9CF", true: c.red }}
              thumbColor={c.surface}
              {...(Platform.OS === "web"
                ? { activeThumbColor: c.surface }
                : {})}
              ios_backgroundColor="#C9C9CF"
            />
          </View>
        ))}
      </Card>
      {!preferences.requireSpeaker ? (
        <Notice>
          Speaker check is off. Announcements may play through this device.
        </Notice>
      ) : null}
      <Card>
        <Row
          icon="help-circle"
          title="Help & support"
          onPress={() => router.push("/help")}
        />
      </Card>
      <Label
        style={{
          color: c.muted,
          textAlign: "center",
          fontSize: 12,
          marginTop: 20,
        }}
      >
        Samanvi Driver · Version 2.0 pilot
      </Label>
    </Screen>
  );
}
