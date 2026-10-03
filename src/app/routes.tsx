import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Label,
  PageHeading,
  Screen,
  StatusPill,
} from "../ui/components";
import { useLibrary } from "../state/library";
import { routeDownloadState } from "../domain/presentation";
import { colors as c } from "../ui/theme";

export default function Routes() {
  const { snapshot, selectRoute, refresh, busy } = useLibrary();
  const [search, setSearch] = useState("");
  const [selecting, setSelecting] = useState<string | null>(null);
  const routes =
    snapshot?.bootstrap.routes.filter((route) =>
      `${route.origin} ${route.destination} ${route.name} ${route.routeCode}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ) ?? [];
  const choose = async (id: string) => {
    setSelecting(id);
    try {
      if (await selectRoute(id)) router.replace("/(tabs)/announcements");
    } finally {
      setSelecting(null);
    }
  };
  return (
    <Screen title="Routes" back>
      <PageHeading
        title="Choose a route"
        description="Select your journey, then save its announcements for offline use."
      />
      <Card
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 16,
          paddingRight: 4,
          gap: 10,
        }}
      >
        <Icon name="search" size={20} color={c.muted} />
        <TextInput
          accessibilityLabel="Search routes"
          placeholder="Search city or route code"
          placeholderTextColor={c.subtle}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 52,
            color: c.text,
            fontSize: 15,
          }}
        />
        {search ? (
          <IconButton
            name="x"
            label="Clear search"
            onPress={() => setSearch("")}
          />
        ) : (
          <View style={{ width: 12 }} />
        )}
      </Card>
      <Label
        accessibilityLiveRegion="polite"
        style={{ fontSize: 13, color: c.muted }}
      >
        {routes.length} {routes.length === 1 ? "route" : "routes"}
        {search ? " found" : " available"}
      </Label>
      {routes.length ? (
        routes.map((route) => {
          const selected = snapshot?.selectedRouteId === route.id;
          const state = routeDownloadState(snapshot, route.id);
          return (
            <Pressable
              key={route.id}
              accessibilityRole="button"
              accessibilityLabel={`Select ${route.name}`}
              accessibilityState={{ selected, disabled: !!busy || !!selecting }}
              aria-current={selected ? "true" : undefined}
              disabled={!!busy || !!selecting}
              onPress={() => void choose(route.id)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Card
                style={{
                  padding: 18,
                  gap: 14,
                  borderColor: selected ? c.red : c.line,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <Label style={{ color: c.muted, fontSize: 12 }}>
                    {route.routeCode}
                  </Label>
                  {selected ? (
                    <StatusPill
                      label="Current route"
                      tone="success"
                      icon="check"
                    />
                  ) : (
                    <Icon name="chevron-right" size={18} color={c.muted} />
                  )}
                </View>
                <View style={{ gap: 5 }}>
                  <Label style={{ fontWeight: "600", fontSize: 17 }}>
                    {route.origin}
                  </Label>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <Icon name="arrow-down-right" size={17} color={c.muted} />
                    <Label style={{ fontWeight: "600", fontSize: 17, flex: 1 }}>
                      {route.destination}
                    </Label>
                  </View>
                </View>
                <Label
                  style={{
                    color: state.ready ? c.green : c.muted,
                    fontSize: 13,
                  }}
                >
                  {selecting === route.id
                    ? "Selecting route…"
                    : state.total === 0
                      ? "No stops published yet"
                      : `${state.total} stops · ${state.ready ? "Saved offline" : "Download needed"}`}
                </Label>
                {state.needsUpdate ? (
                  <StatusPill
                    label="Update available"
                    tone="warning"
                    icon="refresh-cw"
                  />
                ) : null}
              </Card>
            </Pressable>
          );
        })
      ) : (
        <EmptyState
          icon={search ? "search" : "map"}
          title={search ? "No matching routes" : "No routes available"}
          description={
            search
              ? "Try another city or route code, or clear your search."
              : "Your administrator hasn’t published any routes yet. Refresh when they’re ready."
          }
        />
      )}
      <Button
        variant="secondary"
        title="Refresh routes"
        icon="refresh-cw"
        disabled={!!busy || !!selecting}
        onPress={() => void refresh()}
      />
    </Screen>
  );
}
