import { ScrollView, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Brand,
  Button,
  Icon,
  Label,
  LoadingState,
  Notice,
} from "../ui/components";
import { useLibrary } from "../state/library";
import { useColors, useStyles, type Palette } from "../ui/theme";

export default function Welcome() {
  const c = useColors();
  const s = useStyles(makeStyles);
  const { loading, busy, preferences, setPreference, error } = useLibrary();
  if (!loading && preferences.entered) return <Redirect href="/(tabs)" />;
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.center}>
          <Brand />
          <View style={s.art}>
            <Icon name="volume-2" size={44} color={c.red} />
          </View>
          <Label style={s.title}>Every stop,{"\n"}clearly announced.</Label>
          <Label style={s.copy}>
            Connect the bus speaker and pin your frequent routes. Once downloaded,
            their announcements work even when your signal drops.
          </Label>
        </View>
        <View style={s.footer}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {loading ? (
            <LoadingState label={busy ?? "Opening your library"} compact />
          ) : (
            <Button
              title="Get started"
              onPress={() => void setPreference("entered", true)}
            />
          )}
          <Label style={s.small}>Use controls only when safely parked.</Label>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surface },
  content: { flexGrow: 1, padding: 24, gap: 32 },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingTop: 20,
  },
  art: {
    width: 112,
    height: 112,
    backgroundColor: c.redSoft,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  title: {
    textAlign: "center",
    fontSize: 29,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  copy: { color: c.muted, textAlign: "center", fontSize: 15, lineHeight: 24 },
  footer: { gap: 18, paddingBottom: 12 },
  small: { color: c.muted, textAlign: "center", fontSize: 12 },
});
