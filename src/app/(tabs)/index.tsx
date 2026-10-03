import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import {
  AudioRow,
  Brand,
  Button,
  Card,
  Icon,
  Label,
  OutputBadge,
  Screen,
  SectionTitle,
  StatusPill,
  useStartAnnouncement,
  type IconName,
} from "../../ui/components";
import { RouteCard } from "../../ui/route-card";
import { useLibrary } from "../../state/library";
import { colors as c } from "../../ui/theme";
import { isDemo } from "../../services/api";
import { isReady } from "../../domain/catalog";

const quick: { key: string; title: string; icon: IconName }[] = [
  { key: "lunch", title: "Lunch break", icon: "coffee" },
  { key: "dinner", title: "Dinner break", icon: "moon" },
  { key: "toilet|washroom", title: "Toilet break", icon: "users" },
];
export default function Home() {
  const { snapshot } = useLibrary();
  const start = useStartAnnouncement();
  const { fontScale } = useWindowDimensions();
  return (
    <Screen>
      <View style={s.header}>
        <Brand />
        <OutputBadge />
      </View>
      <View style={s.heading}>
        <Label style={s.kicker}>Hello, driver.</Label>
        <Label accessibilityRole="header" style={s.title}>
          Have a good journey.
        </Label>
        <Label style={s.copy}>
          Keep your passengers informed at every stop.
        </Label>
      </View>
      {isDemo ? <StatusPill label="Demo library" /> : null}
      <SectionTitle action="Library" onPress={() => router.push("/library")}>
        Quick announcements
      </SectionTitle>
      <View style={[s.grid, fontScale > 1.3 && { flexDirection: "column" }]}>
        {quick.map((item) => {
          const audio = snapshot?.bootstrap.commonAudios.find((value) =>
            new RegExp(item.key, "i").test(value.title),
          );
          const ready = audio ? isReady(snapshot, audio) : false;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={
                audio
                  ? `${ready ? "Play" : "Download"} ${item.title}`
                  : `${item.title}, not yet published`
              }
              accessibilityState={{ disabled: !audio }}
              disabled={!audio}
              onPress={() => {
                if (!audio) return;
                if (ready) start(audio);
                else router.push("/library");
              }}
              style={({ pressed }) => [
                s.quick,
                !audio && {
                  backgroundColor: c.background,
                  borderStyle: "dashed",
                },
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Icon
                name={item.icon}
                color={audio ? c.red : c.subtle}
                size={24}
              />
              <Label style={s.quickLabel}>{item.title}</Label>
              {!audio ? (
                <Label style={s.unavailable}>Unavailable</Label>
              ) : !ready ? (
                <Label style={s.unavailable}>Download</Label>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: 4 }} />
      <RouteCard />
      <Button
        title="View route announcements"
        onPress={() => router.push("/(tabs)/announcements")}
      />
      {snapshot?.bootstrap.welcomeAudio ? (
        <>
          <SectionTitle>Welcome aboard</SectionTitle>
          <Card>
            <AudioRow audio={snapshot.bootstrap.welcomeAudio} last />
          </Card>
        </>
      ) : null}
      <Label style={s.safety}>Use controls only when safely parked.</Label>
    </Screen>
  );
}
const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  heading: { marginTop: 12, gap: 8 },
  kicker: { fontSize: 13, color: c.muted },
  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  copy: { fontSize: 14, color: c.muted },
  grid: { flexDirection: "row", gap: 10 },
  quick: {
    flex: 1,
    minHeight: 124,
    minWidth: 0,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    padding: 7,
    gap: 13,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 19,
  },
  unavailable: { fontSize: 12, lineHeight: 17, color: c.muted, marginTop: -8 },
  safety: { color: c.muted, textAlign: "center", fontSize: 12, marginTop: 8 },
});
