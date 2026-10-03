import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Label,
  Screen,
  StatusPill,
} from "../ui/components";
import { usePlayback } from "../state/playback";
import { formatDuration } from "../domain/catalog";
import { audioFormat, playbackPresentation } from "../domain/presentation";
import { colors as c } from "../ui/theme";

export default function Player() {
  const p = usePlayback();
  if (!p.active)
    return (
      <Screen title="Announcement" back>
        <EmptyState
          icon="volume-2"
          title="Ready when you are"
          description="Choose an announcement from your route or the home screen."
        />
        <Button
          title="View announcements"
          onPress={() => router.replace("/(tabs)/announcements")}
        />
      </Screen>
    );
  const state = playbackPresentation(p.phase, p.playing);
  const progress =
    p.duration > 0 ? Math.max(0, Math.min(1, p.position / p.duration)) : 0;
  const loading = p.phase === "loading";
  return (
    <Screen title="Announcement" back>
      <View style={s.hero}>
        <View style={s.art}>
          <Icon
            name={p.phase === "finished" ? "check" : "volume-2"}
            size={36}
            color={p.phase === "finished" ? c.green : c.red}
          />
        </View>
        <Label accessibilityRole="header" style={s.title}>
          {p.active.title}
        </Label>
        <Label style={s.caption}>{audioFormat(p.active)} · Saved offline</Label>
        <View accessibilityLiveRegion="polite">
          <StatusPill
            label={state.label}
            tone={
              p.phase === "finished"
                ? "success"
                : p.phase === "error" || p.phase === "interrupted"
                  ? "warning"
                  : "neutral"
            }
          />
        </View>
      </View>
      <View style={{ gap: 12, marginTop: 18 }}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Announcement progress"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, p.duration)}
          aria-valuenow={Math.min(p.position, Math.max(1, p.duration))}
          aria-valuetext={`${formatDuration(p.position)} of ${formatDuration(p.duration)}`}
          style={s.track}
        >
          <View style={[s.fill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Label style={s.caption}>{formatDuration(p.position)}</Label>
          <Label style={s.caption}>{formatDuration(p.duration)}</Label>
        </View>
      </View>
      <View style={s.controls}>
        <View style={s.control}>
          <IconButton
            name="rotate-ccw"
            label="Restart announcement"
            onPress={() => void p.replay()}
          />
          <Label style={s.caption}>Restart</Label>
        </View>
        <View style={s.control}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={state.action}
            aria-busy={loading}
            disabled={loading}
            onPress={() => (p.playing ? p.pause() : void p.resume())}
            style={({ pressed }) => [s.play, { opacity: pressed ? 0.75 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color={c.surface} />
            ) : (
              <Icon
                name={
                  p.playing ? "pause" : state.restart ? "rotate-ccw" : "play"
                }
                color={c.surface}
                size={28}
              />
            )}
          </Pressable>
          <Label style={[s.caption, { color: c.red, fontWeight: "600" }]}>
            {state.action}
          </Label>
        </View>
        <View style={s.control}>
          <IconButton
            name="square"
            label="Stop announcement"
            onPress={p.stop}
          />
          <Label style={s.caption}>Stop</Label>
        </View>
      </View>
      <Card style={{ marginTop: 18 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage audio output"
          onPress={() => router.push("/speaker")}
          style={s.output}
        >
          <Icon
            name={p.output.kind === "bluetooth" ? "bluetooth" : "volume-2"}
            color={c.muted}
          />
          <View style={{ flex: 1, gap: 5 }}>
            <Label style={s.caption}>Audio output</Label>
            <Label style={{ fontSize: 15, fontWeight: "600" }}>
              {p.output.supported ? p.output.name : "Output not verified"}
            </Label>
          </View>
          <Icon name="chevron-right" size={18} color={c.muted} />
        </Pressable>
      </Card>
      <Label style={[s.caption, { textAlign: "center" }]}>
        Playback continues when you leave this screen.
      </Label>
    </Screen>
  );
}
const s = StyleSheet.create({
  hero: { alignItems: "center", gap: 14, paddingTop: 12 },
  art: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: c.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.6,
    textAlign: "center",
    width: "100%",
  },
  caption: { fontSize: 13, lineHeight: 20, color: c.muted },
  track: {
    height: 5,
    backgroundColor: c.line,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: { height: 5, backgroundColor: c.red, borderRadius: 3 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 18,
  },
  control: { alignItems: "center", gap: 8, minWidth: 70 },
  play: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: c.red,
    alignItems: "center",
    justifyContent: "center",
  },
  output: { padding: 18, flexDirection: "row", gap: 14, alignItems: "center" },
});
