import { useState } from "react";
import { View } from "react-native";
import * as Linking from "expo-linking";
import { Button, Notice, Screen } from "../../ui/components";
import { fetchConfig } from "../../services/api";
import { readableError } from "../../domain/catalog";
import { useLibrary } from "../../state/library";

export default function Records() {
  const { online } = useLibrary();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = async () => {
    setOpening(true); setError(null);
    try {
      const config = await fetchConfig();
      if (!config.recordsDriveUrl) throw new Error("The records folder has not been configured. Please contact your administrator.");
      await Linking.openURL(config.recordsDriveUrl);
    } catch (failure) { setError(readableError(failure)); }
    finally { setOpening(false); }
  };
  return <Screen title="Records">
    <View style={{ flex: 1, justifyContent: "center", gap: 18 }}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button title={opening ? "Opening Google Drive…" : "Open Google Drive"} icon="external-link" disabled={opening || !online} onPress={() => void open()} />
    </View>
  </Screen>;
}
