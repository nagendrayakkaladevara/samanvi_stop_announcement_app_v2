import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand, Icon, Label, Notice } from "../ui/components";
import { colors as c } from "../ui/theme";
import { useAuth } from "../state/auth";

export default function LoginScreen() {
  const { signIn, message, clearMessage } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit() {
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    clearMessage();
    try {
      await signIn(username.trim(), password);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <View style={s.header}>
            <Brand />
            <View style={s.routeLine}>
              <View style={s.routeDot} />
              <View style={s.routeTrack} />
              <View style={s.busMark}><Icon name="navigation" size={19} color={c.surface} /></View>
            </View>
            <View style={{ gap: 10 }}>
              <Label style={s.eyebrow}>DRIVER ACCESS</Label>
              <Label accessibilityRole="header" style={s.title}>Your route starts here.</Label>
              <Label style={s.copy}>Sign in with the account provided by your administrator. This account can be registered to one phone only.</Label>
            </View>
          </View>

          <View style={s.card}>
            {message ? <Notice>{message}</Notice> : null}
            {error ? <Notice tone="error">{error}</Notice> : null}
            <View style={{ gap: 8 }}>
              <Label style={s.fieldLabel}>Username</Label>
              <View style={s.inputShell}>
                <Icon name="user" size={19} color={c.muted} />
                <TextInput
                  accessibilityLabel="Username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter your username"
                  placeholderTextColor={c.subtle}
                  returnKeyType="next"
                  style={s.input}
                />
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Label style={s.fieldLabel}>Password</Label>
              <View style={s.inputShell}>
                <Icon name="lock" size={19} color={c.muted} />
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void submit()}
                  placeholder="Enter your password"
                  placeholderTextColor={c.subtle}
                  returnKeyType="go"
                  secureTextEntry={!showPassword}
                  style={s.input}
                />
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} hitSlop={10} onPress={() => setShowPassword((value) => !value)}>
                  <Icon name={showPassword ? "eye-off" : "eye"} size={19} color={c.muted} />
                </Pressable>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              disabled={busy || !username.trim() || !password}
              onPress={() => void submit()}
              style={({ pressed }) => [s.button, { opacity: busy || !username.trim() || !password ? 0.45 : pressed ? 0.75 : 1 }]}
            >
              {busy ? <ActivityIndicator color={c.surface} /> : <Icon name="arrow-right" color={c.surface} />}
              <Label style={s.buttonText}>{busy ? "Checking account…" : "Sign in securely"}</Label>
            </Pressable>
            <View style={s.secureNote}><Icon name="shield" size={16} color={c.green} /><Label style={s.secureText}>Your password and session are stored securely on this device.</Label></View>
          </View>
          <Label style={s.help}>Changed or lost your phone? Contact the administrator to reset your registered device.</Label>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F2EFE9" },
  content: { flexGrow: 1, padding: 22, justifyContent: "center", gap: 24 },
  header: { gap: 24 },
  routeLine: { height: 42, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  routeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.red },
  routeTrack: { flex: 1, height: 2, backgroundColor: "#D7D0C5", marginHorizontal: 8 },
  busMark: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#252B34", transform: [{ rotate: "45deg" }] },
  eyebrow: { fontSize: 11, lineHeight: 16, fontWeight: "700", color: c.red, letterSpacing: 2.2 },
  title: { fontSize: 36, lineHeight: 42, fontWeight: "700", letterSpacing: -1.2, color: "#252B34" },
  copy: { color: "#62646A", fontSize: 15, lineHeight: 24 },
  card: { gap: 19, borderRadius: 24, padding: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: "#E2DDD4", shadowColor: "#252B34", shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#353941" },
  inputShell: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: "#DDDDE1", backgroundColor: "#FAFAFB", paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 11 },
  input: { flex: 1, minHeight: 54, color: c.text, fontSize: 16, paddingVertical: 0 },
  button: { minHeight: 57, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: c.red, marginTop: 2 },
  buttonText: { color: c.surface, fontWeight: "700", fontSize: 15 },
  secureNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secureText: { color: c.muted, fontSize: 11, lineHeight: 17, textAlign: "center", flexShrink: 1 },
  help: { color: c.muted, fontSize: 12, lineHeight: 19, textAlign: "center", paddingHorizontal: 14 },
});
