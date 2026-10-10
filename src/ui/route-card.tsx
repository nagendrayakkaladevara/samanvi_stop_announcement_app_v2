import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Card, Icon, Label, StatusPill } from "./components";
import { useLibrary } from "../state/library";
import type { RouteSummary } from "../domain/catalog";
import { useColors, useStyles, type Palette } from "./theme";

export function RouteCard({ route }: { route: RouteSummary }) {
  const c = useColors();
  const s = useStyles(makeStyles);
  const { catalog, togglePin, pinBusy, online, readiness } = useLibrary();
  const status = readiness(route.id);
  const limitReached = (catalog?.routes.filter((item) => item.isPinned).length ?? 0) >= 3;
  const disabled = !online || pinBusy || (!route.isPinned && limitReached);
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${route.routeId}, ${route.startLocation} to ${route.endLocation}, ${route.via ? `via ${route.via}, ` : ""}${route.busType}. Open announcements`}
        onPress={() => router.push({ pathname: "/route-announcements", params: { id: route.id } })}
        style={({ pressed }) => [s.body, { opacity: pressed ? 0.65 : 1 }]}
      >
        <View style={s.row}>
          <Label style={s.code}>{route.routeId}</Label>
          <StatusPill label={route.busType} />
        </View>
        <Label style={s.journey}>{route.startLocation} → {route.endLocation}</Label>
        <View style={s.row}>
          <Label style={s.via}>{route.via ? `Via ${route.via}` : "Direct route"}</Label>
          <Icon name="chevron-right" size={20} color={c.red} />
        </View>
        {route.isPinned ? <View style={{ gap: 7 }}>
          <StatusPill icon={status.complete ? "check-circle" : "download-cloud"} label={status.label} tone={status.complete ? "success" : "warning"} />
          {status.total > 0 ? <Label style={{ color: c.muted, fontSize: 12 }}>{status.ready} of {status.total} announcements ready</Label> : null}
        </View> : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${route.isPinned ? "Unpin" : "Pin"} ${route.routeId}`}
        accessibilityHint={!route.isPinned && limitReached ? "Unpin another route first. Maximum 3 pinned routes." : undefined}
        accessibilityState={{ disabled, selected: route.isPinned }}
        disabled={disabled}
        onPress={() => void togglePin(route)}
        style={({ pressed }) => [s.pin, { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }]}
      >
        <Icon name={route.isPinned ? "bookmark" : "plus"} size={16} color={route.isPinned ? c.red : c.muted} />
        <Label style={{ fontSize: 13, color: route.isPinned ? c.red : c.muted, fontWeight: "600" }}>{route.isPinned ? "Unpin route" : "Pin route"}</Label>
      </Pressable>
    </Card>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  body: { padding: 18, gap: 13 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  code: { fontSize: 13, fontWeight: "700", color: c.red, letterSpacing: 1 },
  journey: { fontSize: 19, lineHeight: 28, fontWeight: "600" },
  via: { fontSize: 13, color: c.muted, flex: 1 },
  pin: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", minHeight: 48, borderTopWidth: 1, borderColor: c.line },
});
