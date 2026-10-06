import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { AudioRow, Button, Card, EmptyState, PageHeading, Screen } from "../ui/components";
import { useLibrary } from "../state/library";

export default function WelcomeNotes() {
  const { catalog, refresh, busy } = useLibrary();
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const group = catalog?.quickAnnouncements.find((item) => item.id === "welcome-note");
  const audios = group?.type === "MULTIPLE" ? group.audios : [];
  return <Screen title="Welcome Note" back>
    <PageHeading title="Welcome aboard" description="Choose a welcome note for your passengers." />
    {audios.length ? <Card>{audios.map((audio, index) => <AudioRow key={audio.id} audio={audio} last={index === audios.length - 1} />)}</Card> : !busy && catalog ? <EmptyState icon="volume-2" title="No welcome notes available" description="Your administrator can upload welcome-note audios." /> : null}
    <Button title="Refresh welcome notes" variant="secondary" disabled={!!busy} onPress={() => void refresh()} />
  </Screen>;
}
