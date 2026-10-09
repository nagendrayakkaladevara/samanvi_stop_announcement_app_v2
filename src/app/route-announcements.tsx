import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { AudioRow, Button, Card, EmptyState, Label, LoadingState, Notice, PageHeading, Screen } from "../ui/components";
import { fetchRouteAnnouncements } from "../services/api";
import { readableError, type RouteAnnouncements } from "../domain/catalog";
import { useLibrary } from "../state/library";
import { colors as c } from "../ui/theme";

export default function RouteAnnouncementsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { online } = useLibrary();
  const [data, setData] = useState<RouteAnnouncements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    const version = ++request.current;
    setData(null); setLoading(true); setError(null);
    try {
      if (!online) throw new Error("Connect to the internet to open this route.");
      if (!id || Array.isArray(id)) throw new Error("Select a route from the Audio page.");
      const next = await fetchRouteAnnouncements(id);
      if (version === request.current) setData(next);
    } catch (failure) { if (version === request.current) setError(readableError(failure)); }
    finally { if (version === request.current) setLoading(false); }
  }, [id, online]);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current++; }; }, [load]));
  return (
    <Screen title="Route announcements" back refreshing={loading} onRefresh={() => void load()}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading ? <LoadingState label="Loading route announcements" /> : null}
      {data && online ? <>
        <PageHeading title={`${data.route.startLocation} → ${data.route.endLocation}`} description={`${data.routeId} · ${data.route.busType}${data.route.via ? ` · Via ${data.route.via}` : ""}`} />
        <Label style={{ color: c.muted, fontSize: 13 }}>Tap an announcement to play</Label>
        {data.announcements.length ? <Card>{data.announcements.map((audio, index) => (
          <AudioRow key={audio.id} audio={audio} title={`${audio.sequence}. ${audio.title}`} subtitle={`Announcement ${audio.sequence}`} last={index === data.announcements.length - 1} />
        ))}</Card> : <EmptyState icon="volume-2" title="No announcements available" description="Your administrator can add announcements to this route." />}
      </> : null}
      <Button title="Refresh announcements" variant="secondary" disabled={loading} onPress={() => void load()} />
    </Screen>
  );
}
