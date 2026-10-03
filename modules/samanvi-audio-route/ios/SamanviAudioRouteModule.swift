import AVFoundation
import ExpoModulesCore

public class SamanviAudioRouteModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("SamanviAudioRoute")
    Events("onRouteChange")
    AsyncFunction("getSnapshot") { self.snapshot() }.runOnQueue(.main)
    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: AVAudioSession.routeChangeNotification,
        object: nil, queue: .main
      ) { [weak self] _ in
        guard let self = self else { return }
        self.sendEvent("onRouteChange", self.snapshot())
      }
    }
    OnStopObserving { self.stopObserving() }
    OnDestroy { self.stopObserving() }
  }

  private func stopObserving() {
    if let observer = observer { NotificationCenter.default.removeObserver(observer) }
    observer = nil
  }

  private func snapshot() -> [String: Any] {
    guard let output = AVAudioSession.sharedInstance().currentRoute.outputs.first else {
      return ["kind": "unknown", "name": "Output unavailable", "supported": false]
    }
    let kind: String
    switch output.portType {
    case .bluetoothA2DP, .bluetoothHFP, .bluetoothLE: kind = "bluetooth"
    case .headphones, .usbAudio, .lineOut: kind = "wired"
    case .builtInSpeaker, .builtInReceiver: kind = "speaker"
    default: kind = "other"
    }
    return ["kind": kind, "name": output.portName, "supported": true]
  }
}
