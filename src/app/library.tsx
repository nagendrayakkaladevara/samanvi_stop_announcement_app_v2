import { router } from "expo-router";
import { AudioRow, Button, Card, PageHeading, Screen, SectionTitle } from "../ui/components";
import { useLibrary, useLibraryAudio } from "../state/library";

export default function Library() {
  const { refresh, busy } = useLibrary();
  const audio = useLibraryAudio();
  return <Screen title="Audio library" back>
    <PageHeading title="Passenger announcements" description="Stream the latest announcements from your administrator." />
    <Button title="View Route Announcements" icon="map" onPress={() => router.navigate("/(tabs)/announcements")} />
    <SectionTitle>Quick Announcements</SectionTitle>
    {audio.length ? <Card>{audio.map((item, index) => <AudioRow key={`${item.id}-${index}`} audio={item} last={index === audio.length - 1} />)}</Card> : null}
    <Button title="Refresh announcements" icon="refresh-cw" variant="secondary" disabled={!!busy} onPress={() => void refresh()} />
  </Screen>;
}
