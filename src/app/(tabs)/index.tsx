import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import {
  Brand,
  Button,
  Icon,
  Label,
  OutputBadge,
  Screen,
  SectionTitle,
  useStartAnnouncement,
  type IconName,
} from "../../ui/components";
import { RouteCard } from "../../ui/route-card";
import { useLibrary } from "../../state/library";
import { colors as c } from "../../ui/theme";

const quick: { key: string; title: string; icon: IconName }[] = [
  { key: "welcome-note", title: "Welcome Note", icon: "volume-2" },
  { key: "dinner-break", title: "Dinner Break", icon: "moon" },
  { key: "toilet-break", title: "Toilet Break", icon: "users" },
];
export default function Home() {
  const { catalog } = useLibrary();
  const pinned = catalog?.routes.filter((route) => route.isPinned) ?? [];
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
      <SectionTitle>
        Quick announcements
      </SectionTitle>
      <View style={[s.grid, fontScale > 1.3 && { flexDirection: "column" }]}>
        {quick.map((item) => {
          const announcement = catalog?.quickAnnouncements.find((value) => value.id === item.key);
          const available = announcement?.type === "MULTIPLE" ? announcement.audios.length > 0 : !!announcement?.audio;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={
                available
                  ? `${announcement?.type === "MULTIPLE" ? "Choose" : "Play"} ${item.title}`
                  : `${item.title}, not yet published`
              }
              accessibilityState={{ disabled: !available }}
              disabled={!available}
              onPress={() => {
                if (announcement?.type === "MULTIPLE") router.push("/welcome-notes");
                else if (announcement?.audio) start(announcement.audio);
              }}
              style={({ pressed }) => [
                s.quick,
                !available && {
                  backgroundColor: c.background,
                  borderStyle: "dashed",
                },
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Icon
                name={item.icon}
                color={available ? c.red : c.subtle}
                size={24}
              />
              <Label style={s.quickLabel}>{item.title}</Label>
              {!available ? (
                <Label style={s.unavailable}>Unavailable</Label>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: 4 }} />
      <SectionTitle action={pinned.length ? "View all" : undefined} onPress={() => router.navigate("/(tabs)/announcements")}>Pinned Routes</SectionTitle>
      {pinned.length ? pinned.map((route) => <RouteCard key={route.id} route={route} />) : (
        <Button title="View Route Announcements" onPress={() => router.navigate("/(tabs)/announcements")} />
      )}
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
