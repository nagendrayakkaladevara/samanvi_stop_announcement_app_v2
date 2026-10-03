import { View } from "react-native";
import { router } from "expo-router";
import {
  AudioRow,
  Button,
  Card,
  EmptyState,
  Icon,
  Label,
  PageHeading,
  Screen,
  SectionTitle,
  StatusPill,
} from "../ui/components";
import { useLibrary, useLibraryAudio } from "../state/library";
import { isReady } from "../domain/catalog";
import { routeDownloadState } from "../domain/presentation";
import { colors as c } from "../ui/theme";

export default function Library() {
  const library = useLibrary();
  const audio = useLibraryAudio();
  const ready = audio.filter((item) => isReady(library.snapshot, item)).length;
  const id = library.snapshot?.selectedRouteId;
  const selectedState = id ? routeDownloadState(library.snapshot, id) : null;
  const manifest = id ? library.snapshot?.manifests[id] : undefined;
  const common = library.snapshot
    ? [
        ...(library.snapshot.bootstrap.welcomeAudio
          ? [library.snapshot.bootstrap.welcomeAudio]
          : []),
        ...library.snapshot.bootstrap.commonAudios,
      ]
    : [];
  const routes =
    library.snapshot?.bootstrap.routes.filter(
      (route) => library.snapshot?.manifests[route.id],
    ) ?? [];
  const complete = audio.length > 0 && ready === audio.length;
  return (
    <Screen title="Audio library" back>
      <PageHeading
        title="Your saved audio"
        description="Prepare your announcements before the journey."
      />
      <Card style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon
            name={complete ? "check-circle" : "download-cloud"}
            color={complete ? c.green : c.muted}
            size={25}
          />
          <View style={{ flex: 1, gap: 3 }}>
            <Label style={{ fontSize: 19, lineHeight: 27, fontWeight: "600" }}>
              {ready} of {audio.length} files saved
            </Label>
            <Label style={{ fontSize: 13, color: c.muted }}>
              {complete
                ? "Saved audio is available offline."
                : "Download audio to make it available offline."}
            </Label>
          </View>
        </View>
        {audio.length ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Audio downloaded"
            aria-valuemin={0}
            aria-valuemax={audio.length}
            aria-valuenow={ready}
            style={{
              height: 5,
              borderRadius: 3,
              backgroundColor: c.line,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${(ready / audio.length) * 100}%`,
                height: 5,
                backgroundColor: complete ? c.green : c.red,
              }}
            />
          </View>
        ) : null}
        {library.snapshot ? (
          <Label style={{ fontSize: 12, color: c.muted }}>
            Last synced{" "}
            {new Date(library.snapshot.lastSyncedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Label>
        ) : null}
      </Card>
      {id ? (
        <Button
          title={
            selectedState?.needsUpdate
              ? "Update route audio"
              : manifest && (selectedState?.ready || selectedState?.total === 0)
                ? "Check route audio"
                : "Download route audio"
          }
          icon={
            manifest && (selectedState?.ready || selectedState?.total === 0)
              ? "refresh-cw"
              : "download"
          }
          disabled={!!library.busy}
          onPress={() => void library.downloadRoute(id)}
        />
      ) : (
        <Button
          title="Choose a route"
          icon="map"
          onPress={() => router.push("/routes")}
        />
      )}
      <Button
        title="Refresh common announcements"
        icon="refresh-cw"
        variant="secondary"
        disabled={!!library.busy}
        onPress={() => void library.refresh()}
      />
      {common.length ? (
        <>
          <SectionTitle>Common announcements</SectionTitle>
          <Card>
            {common.map((item, index) => (
              <AudioRow
                key={item.id}
                audio={item}
                last={index === common.length - 1}
                onDownload={() => void library.refresh()}
                downloadBusy={!!library.busy}
              />
            ))}
          </Card>
        </>
      ) : null}
      {routes.map((route) => {
        const items = library.snapshot?.manifests[route.id]?.audios ?? [];
        const state = routeDownloadState(library.snapshot, route.id);
        return (
          <View key={route.id} style={{ gap: 12 }}>
            <SectionTitle>{route.name}</SectionTitle>
            {id === route.id ? (
              <StatusPill label="Current route" icon="map-pin" />
            ) : null}
            {state.needsUpdate ? (
              <StatusPill
                label="Update available"
                tone="warning"
                icon="refresh-cw"
              />
            ) : null}
            {items.length ? (
              <Card>
                {[...items]
                  .sort((a, b) => a.position - b.position)
                  .map((item, index, sorted) => (
                    <AudioRow
                      key={`${item.position}-${item.audio.id}`}
                      audio={item.audio}
                      title={item.stopLabel || undefined}
                      last={index === sorted.length - 1}
                      onDownload={() => void library.downloadRoute(route.id)}
                      downloadBusy={!!library.busy}
                    />
                  ))}
              </Card>
            ) : (
              <Label style={{ color: c.muted, fontSize: 14 }}>
                No stop announcements have been published for this route.
              </Label>
            )}
          </View>
        );
      })}
      {!audio.length ? (
        <EmptyState
          icon="download-cloud"
          title="Nothing saved yet"
          description="Refresh the common announcements, then choose and download a route. Your administrator manages the available audio."
        />
      ) : null}
      <Label
        style={{ color: c.muted, fontSize: 13, lineHeight: 21, marginTop: 8 }}
      >
        An interrupted download keeps your previous library available. You can
        retry when your connection improves.
      </Label>
    </Screen>
  );
}
