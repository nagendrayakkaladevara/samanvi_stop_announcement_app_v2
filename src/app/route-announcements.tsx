import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { AudioRow, Button, Card, EmptyState, Label, LoadingState, Notice, PageHeading, Screen, StatusPill } from "../ui/components";
import { MobileApiError } from "../services/api";
import { readableError, type RouteAnnouncements } from "../domain/catalog";
import { useLibrary } from "../state/library";
import { useColors } from "../ui/theme";

export default function RouteAnnouncementsScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loadRoute, readiness, retryDownloads, catalog } = useLibrary();
  const [data, setData] = useState<RouteAnnouncements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const route = catalog?.routes.find((item) => item.id === id);
  const load = useCallback(async (force = false) => {
    const version = ++request.current;
    setLoading(true); setError(null);
    try {
      if (!id || Array.isArray(id)) throw new Error("Select a route from the Audio page.");
      const next = await loadRoute(id, force);
      if (version === request.current) setData(next);
    } catch (failure) {
      if (version === request.current) {
        if (failure instanceof MobileApiError && failure.status === 404) setData(null);
        setError(readableError(failure));
      }
    } finally { if (version === request.current) setLoading(false); }
  }, [id, loadRoute]);
  const catalogVersion = catalog;
  useFocusEffect(useCallback(() => {
    if (catalogVersion) void load();
    return () => { request.current++; };
  }, [load, catalogVersion]));
  const status = readiness(id);
  const current = data?.route.id === id && route ? data : null;
  return <Screen title="Route announcements" back onRefresh={() => load(true)}>
    {error ? <Notice tone="error">{error}</Notice> : null}
    {loading && !current ? <LoadingState label="Loading route announcements" /> : null}
    {current ? <>
      <PageHeading title={`${current.route.startLocation} → ${current.route.endLocation}`} description={`${current.routeId} · ${current.route.busType}${current.route.via ? ` · Via ${current.route.via}` : ""}`} />
      {route?.isPinned ? <>
        <StatusPill label={`${status.label}${status.total ? ` · ${status.ready}/${status.total}` : ""}`} icon={status.complete ? "check-circle" : "download-cloud"} tone={status.complete ? "success" : "warning"} />
        {status.error ? <><Notice tone="error">{status.error}</Notice><Button title="Retry downloads" variant="secondary" onPress={retryDownloads} /></> : null}
      </> : <Notice>Pin this route on the Audio page to prepare it for offline playback.</Notice>}
      <Label style={{ color: c.muted, fontSize: 13 }}>Tap an announcement to play</Label>
      {current.announcements.length ? <Card>{current.announcements.map((audio, index) => <AudioRow key={audio.id} audio={audio} title={`${audio.sequence}. ${audio.title}`} subtitle={`Announcement ${audio.sequence}`} last={index === current.announcements.length - 1} />)}</Card> : <EmptyState icon="volume-2" title="No announcements available" description="Your administrator can add announcements to this route." />}
    </> : null}
    <Button title="Refresh announcements" variant="secondary" disabled={loading} onPress={() => void load(true)} />
  </Screen>;
}
