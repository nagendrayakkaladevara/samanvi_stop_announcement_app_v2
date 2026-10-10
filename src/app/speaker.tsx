import { useState } from "react";
import { Alert, Linking, Platform, View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Icon,
  Label,
  Notice,
  PageHeading,
  Screen,
  SectionTitle,
  StatusPill,
  confirmAction,
  useStartAnnouncement,
} from "../ui/components";
import { usePlayback } from "../state/playback";
import { useLibrary } from "../state/library";
import { isExternal } from "../domain/playback-gate";
import { useColors } from "../ui/theme";

export default function Speaker() {
  const c = useColors();
  const { output, refreshOutput } = usePlayback();
  const { testAudio } = useLibrary();
  const start = useStartAnnouncement();
  const connected = isExternal(output);
  const web = Platform.OS === "web";
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<string | null>(null);
  const openSettings = () => {
    if (Platform.OS === "android")
      void Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS").catch(() =>
        Alert.alert(
          "Open Bluetooth settings",
          "Open Settings → Bluetooth on your phone and select the bus speaker.",
        ),
      );
    else
      Alert.alert(
        "Connect in Settings",
        "Open Settings → Bluetooth, select the bus speaker, then return to Samanvi.",
      );
  };
  const check = async () => {
    setChecking(true);
    try {
      const next = await refreshOutput();
      setChecked(
        isExternal(next)
          ? "Connection checked. Play a sound test to confirm the bus output."
          : "Connection checked. A bus speaker has not been verified yet.",
      );
    } finally {
      setChecking(false);
    }
  };
  const test = () => {
    if (!testAudio) return;
    if (connected) start(testAudio);
    else
      confirmAction(
        "Play on this device?",
        "The announcement may play through this device’s speaker. Check the media volume first.",
        () => start(testAudio, true),
        "Play test",
      );
  };
  return (
    <Screen title="Bus speaker" back>
      <PageHeading
        title={connected ? "Ready for a sound check" : "Check your speaker"}
        description="Confirm where your passengers will hear the announcement."
      />
      <Card style={{ padding: 18, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: connected ? c.greenSoft : c.background,
            }}
          >
            <Icon
              name={connected ? "check-circle" : "bluetooth"}
              color={connected ? c.green : c.muted}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Label style={{ fontSize: 13, color: c.muted }}>Audio output</Label>
            <Label style={{ fontWeight: "600" }}>
              {output.supported ? output.name : "Output not verified"}
            </Label>
          </View>
        </View>
        <StatusPill
          label={
            connected
              ? "Speaker connected"
              : web
                ? "Browser preview"
                : "Check connection"
          }
          tone={connected ? "success" : "neutral"}
        />
      </Card>
      {web ? (
        <Notice>
          This preview cannot check Bluetooth. You can test the audio on this
          device.
        </Notice>
      ) : null}
      {!web && !connected ? (
        <Button
          title={
            Platform.OS === "ios"
              ? "How to connect in Settings"
              : "Open Bluetooth settings"
          }
          icon="bluetooth"
          onPress={openSettings}
        />
      ) : null}
      {testAudio ? (
        <>
          <Button
            title={connected ? "Play test announcement" : "Test on this device"}
            icon="volume-2"
            variant={connected || web ? "primary" : "secondary"}
            onPress={test}
          />
          <Label style={{ fontSize: 13, color: c.muted }}>
            Test announcement: {testAudio.title}
          </Label>
        </>
      ) : (
        <>
          <Notice>Load an announcement before running a sound test.</Notice>
          <Button
            title="Open audio library"
            icon="headphones"
            onPress={() => router.push("/library")}
          />
        </>
      )}
      {!web ? (
        <Button
          title={checking ? "Checking connection…" : "Check connection"}
          icon="refresh-cw"
          variant="secondary"
          disabled={checking}
          onPress={() => void check()}
        />
      ) : null}
      {checked ? (
        <Notice tone={connected ? "success" : "info"}>{checked}</Notice>
      ) : null}
      <SectionTitle>Connect on your phone</SectionTitle>
      <Card style={{ padding: 18, gap: 18 }}>
        {[
          "Turn on the bus audio system.",
          "Pair it in your phone’s Bluetooth settings.",
          "Return here and play a test announcement.",
        ].map((step, index) => (
          <View key={step} style={{ flexDirection: "row", gap: 12 }}>
            <Label style={{ color: c.red, fontWeight: "600", fontSize: 14 }}>
              {index + 1}
            </Label>
            <Label style={{ flex: 1, fontSize: 14, lineHeight: 22 }}>
              {step}
            </Label>
          </View>
        ))}
      </Card>
      {!web && connected ? (
        <Button title="Change speaker" variant="quiet" onPress={openSettings} />
      ) : null}
    </Screen>
  );
}
