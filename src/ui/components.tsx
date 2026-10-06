import React, { type ComponentProps, type PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type TextProps,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { colors as c, layout } from "./theme";
import { useLibrary } from "../state/library";
import { usePlayback } from "../state/playback";
import { formatDuration, type AudioAsset } from "../domain/catalog";
import { isExternal } from "../domain/playback-gate";
import { audioFormat, playbackPresentation } from "../domain/presentation";

export type IconName = ComponentProps<typeof Feather>["name"];
export function Icon({
  name,
  size = 22,
  color = c.text,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return (
    <Feather
      name={name}
      size={size}
      color={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    />
  );
}
export function Label({ children, style, ...props }: TextProps) {
  return (
    <Text {...props} style={[styles.text, style]}>
      {children}
    </Text>
  );
}
export function Brand() {
  return (
    <Image
      accessibilityLabel="Samanvi Travels"
      accessibilityRole="image"
      resizeMode="contain"
      source={require("../../assets/samv_logo.png")}
      style={styles.brandLogo}
    />
  );
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function PageHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Label accessibilityRole="header" style={styles.title}>
        {title}
      </Label>
      {description ? (
        <Label style={{ color: c.muted, lineHeight: 23 }}>{description}</Label>
      ) : null}
    </View>
  );
}
export function StatusPill({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
  icon?: IconName;
}) {
  const color =
    tone === "success" ? c.green : tone === "warning" ? c.amber : c.muted;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 9,
        backgroundColor:
          tone === "success"
            ? c.greenSoft
            : tone === "warning"
              ? c.amberSoft
              : c.background,
      }}
    >
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <Label
        style={{
          color,
          fontSize: 12,
          lineHeight: 19,
          fontWeight: "500",
          flexShrink: 1,
        }}
      >
        {label}
      </Label>
    </View>
  );
}
export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondary,
        variant === "quiet" && styles.quiet,
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={19}
          color={variant === "primary" ? c.surface : c.text}
        />
      ) : null}
      <Label
        style={[
          styles.buttonText,
          {
            color:
              variant === "primary"
                ? c.surface
                : variant === "quiet"
                  ? c.red
                  : c.text,
            flexShrink: 1,
          },
        ]}
      >
        {title}
      </Label>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  color = c.text,
  size = 48,
  disabled = false,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: Math.max(size, 44),
        height: Math.max(size, 44),
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.5 : 1,
      })}
    >
      <Icon name={name} color={color} />
    </Pressable>
  );
}
export function SectionTitle({
  children,
  action,
  onPress,
}: PropsWithChildren<{ action?: string; onPress?: () => void }>) {
  return (
    <View style={styles.section}>
      <Label style={styles.sectionTitle}>{children}</Label>
      {action && onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={action}
          style={styles.linkTarget}
        >
          <Label style={styles.link}>{action}</Label>
        </Pressable>
      ) : null}
    </View>
  );
}
export function Notice({
  children,
  tone = "info",
  onDismiss,
}: PropsWithChildren<{
  tone?: "info" | "error" | "success";
  onDismiss?: () => void;
}>) {
  const color =
    tone === "error" ? c.red : tone === "success" ? c.green : c.blue;
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        {
          backgroundColor:
            tone === "error"
              ? c.redSoft
              : tone === "success"
                ? c.greenSoft
                : c.blueSoft,
        },
      ]}
    >
      <Icon
        name={tone === "success" ? "check-circle" : "info"}
        size={17}
        color={color}
      />
      <Label style={{ flex: 1, color, fontSize: 14, lineHeight: 21 }}>
        {children}
      </Label>
      {onDismiss ? (
        <IconButton
          name="x"
          size={36}
          label="Dismiss message"
          onPress={onDismiss}
          color={color}
        />
      ) : null}
    </View>
  );
}
export function Screen({
  children,
  title,
  kicker,
  back = false,
}: PropsWithChildren<{ title?: string; kicker?: string; back?: boolean }>) {
  const library = useLibrary();
  const playback = usePlayback();
  const insets = useSafeAreaInsets();
  const scrollRef = React.useRef<ScrollView>(null);
  React.useEffect(() => {
    if (library.error || playback.message) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [library.error, playback.message]);
  const hasMini =
    !back && !!playback.active && !["idle", "stopped"].includes(playback.phase);
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {back ? (
        <View style={styles.topbar}>
          <IconButton
            name="chevron-left"
            label="Go back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
          />
          <Label accessibilityRole="header" style={styles.topbarTitle}>
            {title}
          </Label>
          <View style={{ width: 48 }} />
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: back
              ? Math.max(insets.bottom, 16) + 20
              : hasMini
                ? 116
                : 28,
          },
        ]}
      >
        {!back && title ? (
          <View style={{ gap: 7, marginBottom: 12 }}>
            {kicker ? <Label style={styles.kicker}>{kicker}</Label> : null}
            <Label accessibilityRole="header" style={styles.title}>
              {title}
            </Label>
          </View>
        ) : null}
        {!library.online ? (
          <Notice>
            Connect to the internet to use announcements and records.
          </Notice>
        ) : null}
        {library.error ? (
          <View style={{ gap: 10 }}>
            <Notice tone="error" onDismiss={library.clearError}>{library.error}</Notice>
            {!library.catalog ? <Button title="Retry connection" variant="secondary" disabled={!!library.busy} onPress={() => void library.refresh()} /> : null}
          </View>
        ) : null}
        {playback.message ? (
          <Notice tone="error" onDismiss={playback.dismissMessage}>
            {playback.message}
          </Notice>
        ) : null}
        {library.busy ? (
          <View accessibilityLiveRegion="polite" style={styles.progress}>
            <ActivityIndicator size="small" color={c.red} />
            <Label style={styles.caption}>{library.busy}…</Label>
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function OutputBadge() {
  const { output } = usePlayback();
  const external = isExternal(output);
  return (
    <Pressable
      onPress={() => router.push("/speaker")}
      accessibilityRole="button"
      accessibilityLabel="Manage audio output"
      style={[
        styles.badge,
        { backgroundColor: external ? c.greenSoft : c.amberSoft },
      ]}
    >
      <Icon name="bluetooth" size={14} color={external ? c.green : c.amber} />
      <Label
        style={{
          fontSize: 12,
          fontWeight: "600",
          color: external ? c.green : c.amber,
        }}
      >
        {external ? "Speaker ready" : "Check speaker"}
      </Label>
    </Pressable>
  );
}
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.heroIcon}>
        <Icon name={icon} size={32} color={c.red} />
      </View>
      <Label accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Label>
      <Label style={styles.emptyCopy}>{description}</Label>
    </View>
  );
}
export function confirmAction(
  title: string,
  message: string,
  action: () => void,
  confirmLabel = "Continue",
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) action();
  } else
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: confirmLabel, onPress: action },
    ]);
}
export function useStartAnnouncement() {
  const playback = usePlayback();
  return (audio: AudioAsset, allowPhone = false) => {
    const run = () => {
      void playback.play(audio, allowPhone).then((started) => {
        if (started) router.push("/player");
      });
    };
    if (playback.playing && playback.active?.id !== audio.id)
      confirmAction(
        "Switch announcement?",
        `${playback.active?.title} is playing. Stop it and play ${audio.title}?`,
        run,
        "Switch & play",
      );
    else run();
  };
}
export function AudioRow({
  audio,
  subtitle,
  last = false,
  title,
}: {
  audio: AudioAsset;
  subtitle?: string;
  last?: boolean;
  title?: string;
}) {
  const { online } = useLibrary();
  const start = useStartAnnouncement();
  const playback = usePlayback();
  const current =
    playback.active?.id === audio.id &&
    ["loading", "playing", "paused"].includes(playback.phase);
  const displayTitle = title ?? audio.title;
  const disabled = !online;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        current
          ? `Open ${displayTitle}`
          : `Play ${displayTitle}`
      }
      accessibilityState={{ selected: current, disabled }}
      aria-current={current ? "true" : undefined}
      disabled={disabled}
      onPress={() =>
        current
          ? router.push("/player")
          : start(audio)
      }
      style={({ pressed }) => [
        styles.audioRow,
        !last && styles.rowLine,
        current && { backgroundColor: c.redSoft },
        { opacity: disabled ? 0.55 : pressed ? 0.6 : 1 },
      ]}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <Label style={styles.rowTitle}>{displayTitle}</Label>
        <Label style={styles.caption}>
          {current
            ? playbackPresentation(playback.phase, playback.playing).label
            : (subtitle ?? `${audioFormat(audio)} · Tap to play`)}
        </Label>
      </View>
      <View
        style={[
          styles.playChip,
          { backgroundColor: c.redSoft },
        ]}
      >
        <Icon
          name={
            current
              ? playback.playing
                ? "volume-2"
                : "pause"
              : "play"
          }
          color={c.red}
          size={20}
        />
      </View>
    </Pressable>
  );
}
export function MiniPlayer() {
  const { active, phase, playing, pause, resume, position, duration } =
    usePlayback();
  if (!active || phase === "stopped" || phase === "idle") return null;
  const presentation = playbackPresentation(phase, playing);
  return (
    <View style={styles.mini}>
      <Pressable
        style={{ flex: 1, gap: 4, minHeight: 48, justifyContent: "center" }}
        accessibilityRole="button"
        accessibilityLabel="Open announcement player"
        onPress={() => router.push("/player")}
      >
        <Label numberOfLines={1} style={{ fontWeight: "600", fontSize: 14 }}>
          {active.title}
        </Label>
        <Label style={styles.caption}>
          {phase === "playing"
            ? `${formatDuration(position)} / ${formatDuration(duration)}`
            : presentation.label}
        </Label>
      </Pressable>
      <IconButton
        name={playing ? "pause" : presentation.restart ? "rotate-ccw" : "play"}
        label={`${presentation.action} announcement`}
        disabled={phase === "loading"}
        color={c.red}
        onPress={() => (playing ? pause() : void resume())}
      />
    </View>
  );
}
export const styles = StyleSheet.create({
  text: { color: c.text, fontSize: 15, lineHeight: 22 },
  screen: { flex: 1, backgroundColor: c.background },
  scroll: { flexGrow: 1, padding: layout.gutter, gap: layout.gap },
  title: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 35,
    letterSpacing: -0.65,
  },
  kicker: { fontSize: 13, color: c.muted },
  caption: { fontSize: 13, lineHeight: 20, color: c.muted },
  brandLogo: { width: 146, height: 36 },
  card: {
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  button: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: c.red,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  secondary: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  quiet: {
    backgroundColor: "transparent",
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  buttonText: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600", flexShrink: 1 },
  linkTarget: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    flexShrink: 0,
  },
  link: { color: c.red, fontSize: 13, fontWeight: "600" },
  notice: {
    borderRadius: 12,
    padding: 13,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  topbar: {
    minHeight: 60,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topbarTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 9,
    borderRadius: 18,
    minHeight: 44,
  },
  empty: { alignItems: "center", paddingVertical: 24, gap: 16 },
  heroIcon: {
    width: 80,
    height: 80,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "600",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  emptyCopy: {
    color: c.muted,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 320,
  },
  audioRow: {
    paddingHorizontal: 20,
    paddingVertical: 17,
    minHeight: 83,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  rowLine: { borderBottomWidth: 1, borderBottomColor: c.line },
  rowTitle: { fontWeight: "600", fontSize: 15 },
  playChip: {
    height: 46,
    width: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  mini: {
    backgroundColor: c.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    paddingLeft: 17,
    paddingRight: 8,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
});
