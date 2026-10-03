import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useLibrary } from "../state/library";
import { Button, Card, Icon, Label, styles as shared } from "./components";
import { colors as c } from "./theme";
import { routeDownloadState } from "../domain/presentation";

export function RouteCard() {
  const { snapshot } = useLibrary();
  const route = snapshot?.bootstrap.routes.find(
    (item) => item.id === snapshot.selectedRouteId,
  );
  if (!route)
    return (
      <Card style={{ padding: 22, gap: 16 }}>
        <Label style={{ fontSize: 18, fontWeight: "600" }}>
          Choose today’s route
        </Label>
        <Label style={{ color: c.muted }}>
          Your stops and saved announcements will be ready when you are.
        </Label>
        <Button title="Choose a route" onPress={() => router.push("/routes")} />
      </Card>
    );
  const { ready, total, saved, needsUpdate } = routeDownloadState(
    snapshot,
    route.id,
  );
  return (
    <Card style={s.card}>
      <View style={s.top}>
        <Label style={s.eyebrow}>CURRENT ROUTE</Label>
        <Button
          title="Change"
          variant="quiet"
          onPress={() => router.push("/routes")}
        />
      </View>
      <View style={s.cities}>
        <View style={s.cityRow}>
          <View style={s.dot} />
          <Label style={s.city}>{route.origin}</Label>
        </View>
        <View style={s.connector} />
        <View style={s.cityRow}>
          <View style={[s.dot, s.destinationDot]} />
          <Label style={s.city}>{route.destination}</Label>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 7, alignItems: "center" }}>
        <Icon
          name={ready ? "check-circle" : "download"}
          size={14}
          color={ready ? c.green : c.muted}
        />
        <Label style={[shared.caption, { flex: 1 }]}>
          {total === 0
            ? "No stops published yet"
            : `${total} stops · ${ready ? "Saved offline" : `${saved} saved`}`}
        </Label>
      </View>
      {needsUpdate ? (
        <Label style={{ color: c.amber, fontSize: 13, marginTop: 8 }}>
          A route update is available in your audio library.
        </Label>
      ) : null}
    </Card>
  );
}
const s = StyleSheet.create({
  card: { paddingHorizontal: 20, paddingBottom: 21 },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: c.muted,
    letterSpacing: 0.6,
  },
  cities: { gap: 12, marginTop: 4, marginBottom: 18 },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  city: { fontSize: 17, fontWeight: "600", flex: 1, lineHeight: 25 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.red },
  destinationDot: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.red,
  },
  connector: {
    position: "absolute",
    top: 22,
    left: 3.5,
    height: 18,
    borderLeftWidth: 1,
    borderColor: c.line,
  },
});
