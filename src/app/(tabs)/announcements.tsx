import { router } from "expo-router";
import {
  AudioRow,
  Button,
  Card,
  EmptyState,
  Notice,
  Screen,
  SectionTitle,
} from "../../ui/components";
import { RouteCard } from "../../ui/route-card";
import { useLibrary } from "../../state/library";
import { routeDownloadState } from "../../domain/presentation";

export default function Announcements() {
  const { snapshot, downloadRoute, busy } = useLibrary();
  const id = snapshot?.selectedRouteId;
  const manifest = id ? snapshot?.manifests[id] : undefined;
  const state = id ? routeDownloadState(snapshot, id) : null;
  return (
    <Screen title="Route audio" kicker="Announcements for your journey">
      <RouteCard />
      {state?.needsUpdate ? (
        <>
          <Notice>
            Your saved audio is still available. Download the latest route
            before your next journey.
          </Notice>
          <Button
            title="Update route audio"
            disabled={!!busy}
            onPress={() => {
              if (id) void downloadRoute(id);
            }}
            icon="download"
          />
        </>
      ) : null}
      {manifest?.audios.length ? (
        <>
          <SectionTitle
            action="Library"
            onPress={() => router.push("/library")}
          >
            Route stops
          </SectionTitle>
          <Card>
            {[...manifest.audios]
              .sort((a, b) => a.position - b.position)
              .map((item, index, items) => (
                <AudioRow
                  key={`${item.position}-${item.audio.id}`}
                  audio={item.audio}
                  title={item.stopLabel || undefined}
                  subtitle={`${index + 1}. ${index === 0 ? "Departure" : index === items.length - 1 ? "Final stop" : "Arrival"} · Saved offline`}
                  last={index === items.length - 1}
                  downloadBusy={!!busy}
                  onDownload={() => {
                    if (id) void downloadRoute(id);
                  }}
                />
              ))}
          </Card>
        </>
      ) : manifest ? (
        <>
          <EmptyState
            icon="map-pin"
            title="No stops published yet"
            description="Your administrator can add stop announcements to this route. Check again when they’re ready."
          />
          <Button
            title="Check route audio"
            variant="secondary"
            disabled={!!busy}
            onPress={() => {
              if (id) void downloadRoute(id);
            }}
          />
        </>
      ) : id ? (
        <>
          <EmptyState
            icon="download-cloud"
            title="Save your route audio"
            description="Download the announcements once, then play them without an internet connection."
          />
          <Button
            title="Download route audio"
            icon="download"
            disabled={!!busy}
            onPress={() => void downloadRoute(id)}
          />
        </>
      ) : (
        <EmptyState
          icon="map"
          title="Your journey starts here"
          description="Choose a published route above to see its stops and announcements."
        />
      )}
    </Screen>
  );
}
