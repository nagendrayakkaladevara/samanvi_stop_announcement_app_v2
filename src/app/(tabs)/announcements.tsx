import { useCallback, useState } from "react";
import { TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, Card, EmptyState, Icon, Label, Screen } from "../../ui/components";
import { RouteCard } from "../../ui/route-card";
import { useLibrary } from "../../state/library";
import { colors as c } from "../../ui/theme";

export default function Announcements() {
  const { catalog, refresh, busy, loading } = useLibrary();
  const [search, setSearch] = useState("");
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const routes = catalog?.routes.filter((route) =>
    `${route.routeId} ${route.startLocation} ${route.endLocation} ${route.via} ${route.busType}`.toLowerCase().includes(search.trim().toLowerCase()),
  ) ?? [];
  const pins = catalog?.routes.filter((route) => route.isPinned).length ?? 0;
  return (
    <Screen title="Audio" kicker="Route announcements">
      <Card style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 }}>
        <Icon name="search" size={20} color={c.muted} />
        <TextInput accessibilityLabel="Search routes" placeholder="Search route or location" placeholderTextColor={c.subtle} value={search} onChangeText={setSearch} autoCorrect={false} style={{ flex: 1, minWidth: 0, minHeight: 54, color: c.text, fontSize: 15 }} />
      </Card>
      <View style={{ gap: 4 }}>
        <Label style={{ color: c.muted, fontSize: 13 }}>{pins} of 3 routes pinned</Label>
        {pins === 3 ? <Label style={{ color: c.amber, fontSize: 13 }}>Unpin a route to pin another.</Label> : null}
      </View>
      {routes.map((route) => <RouteCard key={route.id} route={route} />)}
      {!routes.length && !loading && !busy && catalog ? <EmptyState icon="map" title={search ? "No matching routes" : "No routes available"} description={search ? "Try a different route ID or location." : "Your administrator can publish routes here."} /> : null}
      <Button title="Refresh routes" icon="refresh-cw" variant="secondary" disabled={!!busy} onPress={() => void refresh()} />
    </Screen>
  );
}
