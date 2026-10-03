import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Icon,
  Label,
  PageHeading,
  Screen,
} from "../ui/components";
import { colors as c } from "../ui/theme";

const topics = [
  {
    title: "No sound from the speaker?",
    copy: "Check the phone’s media volume and selected Bluetooth output. Reconnect the bus speaker, then play a test announcement.",
    action: "Check speaker connection",
    path: "/speaker",
  },
  {
    title: "Missing an announcement?",
    copy: "Open the audio library and download your selected route. If an announcement is still missing, ask your administrator to publish it.",
    action: "Open audio library",
    path: "/library",
  },
  {
    title: "Can I use the app offline?",
    copy: "Yes. Save your route audio before travelling. Downloaded announcements stay available in the installed mobile app without internet.",
    action: "Prepare audio library",
    path: "/library",
  },
  {
    title: "Why did playback stop?",
    copy: "A speaker disconnect, phone call, or another audio app can interrupt playback. Check your output, then resume or replay the announcement.",
    action: "Check audio output",
    path: "/speaker",
  },
] as const;

export default function Help() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen title="Help & support" back>
      <PageHeading
        title="How can we help?"
        description="Quick answers to get your announcements ready."
      />
      {topics.map((topic, index) => (
        <Card key={topic.title}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={topic.title}
            aria-expanded={open === index}
            onPress={() => setOpen(open === index ? null : index)}
            style={({ pressed }) => ({
              minHeight: 64,
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon
              name={
                index === 0
                  ? "volume-2"
                  : index === 1
                    ? "download"
                    : index === 2
                      ? "wifi-off"
                      : "pause-circle"
              }
              color={c.muted}
              size={20}
            />
            <Label style={{ flex: 1, fontWeight: "600", fontSize: 14 }}>
              {topic.title}
            </Label>
            <Icon
              name={open === index ? "chevron-up" : "chevron-down"}
              size={18}
              color={c.muted}
            />
          </Pressable>
          {open === index ? (
            <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 14 }}>
              <Label style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>
                {topic.copy}
              </Label>
              <Button
                title={topic.action}
                variant="secondary"
                onPress={() => router.push(topic.path)}
              />
            </View>
          ) : null}
        </Card>
      ))}
      <View style={{ paddingTop: 8, gap: 8 }}>
        <Label style={{ fontWeight: "600", fontSize: 15 }}>
          Need a route or audio change?
        </Label>
        <Label style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>
          Contact your Samanvi Travels administrator. They manage the routes and
          recordings available in this app.
        </Label>
      </View>
    </Screen>
  );
}
