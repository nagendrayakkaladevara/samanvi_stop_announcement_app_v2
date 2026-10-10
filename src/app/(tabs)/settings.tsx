import { useState } from "react";
import { Platform, Pressable, Switch, View } from "react-native";
import { router } from "expo-router";
import {
  Card,
  Icon,
  Label,
  Screen,
  SectionTitle,
  Notice,
  Button,
  type IconName,
} from "../../ui/components";
import { useLibrary } from "../../state/library";
import { useColors, useTheme, type ThemeMode } from "../../ui/theme";
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
  const c = useColors();
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
  const c = useColors();
  const theme = useTheme();
  const [themeError, setThemeError] = useState<string | null>(null);
  const library = useLibrary();
  const { preferences, setPreference } = library;
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
      <SectionTitle>Appearance</SectionTitle>
      <Card style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name={theme.dark ? "moon" : "sun"} color={c.red} size={20} />
          <View style={{ flex: 1, gap: 3 }}>
            <Label style={{ fontWeight: "600" }}>Your preferred light</Label>
            <Label style={{ color: c.muted, fontSize: 13 }}>Comfortable controls, day or night.</Label>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["light", "dark", "system"] as ThemeMode[]).map((mode) => (
            <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: theme.mode === mode }} aria-checked={theme.mode === mode}
              accessibilityLabel={`${mode} theme`} onPress={() => {
                setThemeError(null);
                void theme.setMode(mode).catch(() => setThemeError("Could not save appearance. Please try again."));
              }} style={{ flex: 1, minHeight: 52, borderRadius: 12, borderWidth: 1,
                borderColor: theme.mode === mode ? c.red : c.line, backgroundColor: theme.mode === mode ? c.redSoft : c.background,
                justifyContent: "center", alignItems: "center" }}>
              <Label style={{ color: theme.mode === mode ? c.red : c.muted, fontWeight: "600", fontSize: 13 }}>{mode[0].toUpperCase() + mode.slice(1)}</Label>
            </Pressable>
          ))}
        </View>
        {themeError ? <Notice tone="error">{themeError}</Notice> : null}
      </Card>
      <SectionTitle>Pinned-route downloads</SectionTitle>
      <Card style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Icon name="download-cloud" color={c.red} />
          <View style={{ flex: 1, gap: 4 }}>
            <Label style={{ fontWeight: "600" }}>{(library.storageBytes / (1024 * 1024)).toFixed(1)} MB saved on this phone</Label>
            <Label style={{ color: c.muted, fontSize: 13 }}>Only your pinned routes · up to 3 routes</Label>
          </View>
        </View>
        <Label style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>
          {library.offlineSupported ? "Wait for Ready offline before departure. Downloads work for 30 days after sync; refreshing applies changes immediately." : "Offline downloads are available in the Android/iOS app. This browser preview streams online."}
        </Label>
        {library.lastSync ? <Label style={{ fontSize: 12, color: c.muted }}>Last sync: {new Date(library.lastSync).toLocaleString()}</Label> : null}
        {library.offlineUntil ? <Label style={{ fontSize: 12, color: library.offlineValid ? c.green : c.amber }}>Offline access until {new Date(library.offlineUntil).toLocaleDateString()}</Label> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Label>Download on Wi-Fi only</Label>
            <Label style={{ color: c.muted, fontSize: 12 }}>Off allows mobile-data downloads</Label>
          </View>
          <Switch accessibilityLabel="Download on Wi-Fi only" value={preferences.wifiOnly}
            onValueChange={(value) => void setPreference("wifiOnly", value)} trackColor={{ false: c.switchTrack, true: c.red }} thumbColor={c.surface} />
        </View>
        <Label style={{ color: c.muted, fontSize: 13 }}>Download storage limit</Label>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {([100, 250, 500] as const).map((size) => <Pressable key={size} accessibilityRole="radio"
            accessibilityLabel={`${size} MB download limit`} accessibilityState={{ checked: preferences.storageMB === size }} aria-checked={preferences.storageMB === size}
            onPress={() => void setPreference("storageMB", size)} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center",
              borderRadius: 10, backgroundColor: preferences.storageMB === size ? c.redSoft : c.background }}>
            <Label style={{ fontSize: 13, color: preferences.storageMB === size ? c.red : c.muted }}>{size} MB</Label>
          </Pressable>)}
        </View>
        <Button title="Sync now" icon="refresh-cw" disabled={!!library.busy || !library.online} onPress={() => void library.refresh()} />
        <Button title="Retry downloads" variant="secondary" disabled={!library.offlineSupported || !library.online} onPress={library.retryDownloads} />
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
              trackColor={{ false: c.switchTrack, true: c.red }}
              thumbColor={c.surface}
              {...(Platform.OS === "web"
                ? { activeThumbColor: c.surface }
                : {})}
              ios_backgroundColor={c.switchTrack}
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
        Samanvi Driver · Version 2.1
      </Label>
    </Screen>
  );
}
