import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, MiniPlayer } from "../../ui/components";
import { colors as c } from "../../ui/theme";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.red,
          tabBarInactiveTintColor: c.muted,
          tabBarStyle: {
            height: 70 + insets.bottom,
            paddingTop: 9,
            paddingBottom: 10 + insets.bottom,
            backgroundColor: c.surface,
            borderTopColor: c.line,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          tabBarLabelPosition: "below-icon",
          sceneStyle: { backgroundColor: c.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => (
              <Icon name="home" color={color} size={21} />
            ),
          }}
        />
        <Tabs.Screen
          name="announcements"
          options={{
            title: "Announcements",
            tabBarLabel: "Audio",
            tabBarIcon: ({ color }) => (
              <Icon name="map" color={color} size={21} />
            ),
          }}
        />
        <Tabs.Screen
          name="records"
          options={{
            title: "Records",
            tabBarIcon: ({ color }) => (
              <Icon name="file-text" color={color} size={21} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <Icon name="settings" color={color} size={21} />
            ),
          }}
        />
      </Tabs>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          bottom: 82 + insets.bottom,
          left: 16,
          right: 16,
        }}
      >
        <MiniPlayer />
      </View>
    </View>
  );
}
