package expo.modules.samanviaudioroute

import android.content.Context
import android.media.MediaRouter
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Observes the system's selected media route; never scans or pairs Bluetooth devices. */
class SamanviAudioRouteModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var observing = false
  private val router: MediaRouter?
    get() = appContext.reactContext?.getSystemService(Context.MEDIA_ROUTER_SERVICE) as? MediaRouter

  private val callback = object : MediaRouter.SimpleCallback() {
    override fun onRouteSelected(router: MediaRouter, type: Int, info: MediaRouter.RouteInfo) { emitRoute() }
    override fun onRouteUnselected(router: MediaRouter, type: Int, info: MediaRouter.RouteInfo) { emitRoute() }
    override fun onRouteChanged(router: MediaRouter, info: MediaRouter.RouteInfo) { emitRoute() }
    override fun onRouteRemoved(router: MediaRouter, info: MediaRouter.RouteInfo) { emitRoute() }
  }

  override fun definition() = ModuleDefinition {
    Name("SamanviAudioRoute")
    Events("onRouteChange")
    AsyncFunction("getSnapshot") { snapshot() }.runOnQueue(Queues.MAIN)
    OnStartObserving {
      mainHandler.post {
        if (!observing) {
          router?.addCallback(MediaRouter.ROUTE_TYPE_LIVE_AUDIO, callback)
          observing = true
        }
        emitRoute()
      }
    }
    OnStopObserving { mainHandler.post { stopObserving() } }
    OnDestroy { mainHandler.post { stopObserving() } }
  }

  private fun stopObserving() { router?.removeCallback(callback); observing = false }
  private fun emitRoute() { if (observing) sendEvent("onRouteChange", snapshot()) }
  private fun snapshot(): Map<String, Any> {
    val route = router?.getSelectedRoute(MediaRouter.ROUTE_TYPE_LIVE_AUDIO)
      ?: return mapOf("kind" to "unknown", "name" to "Output unavailable", "supported" to false)
    val kind = when {
      route.deviceType == MediaRouter.RouteInfo.DEVICE_TYPE_BLUETOOTH -> "bluetooth"
      route.deviceType == MediaRouter.RouteInfo.DEVICE_TYPE_SPEAKER -> "speaker"
      else -> "other"
    }
    return mapOf("kind" to kind, "name" to route.name.toString(), "supported" to true)
  }
}
