package com.netbubble

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

class NetBubblePackage : BaseReactPackage() {
  init {
    // Register the OkHttp interceptor as early as possible — the package is
    // constructed during app startup, before the RN OkHttp client is built and
    // before the first network request. The interceptor stays a passthrough
    // until JS calls start().
    NetBubbleInterceptor.install()
  }

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == NetBubbleModule.NAME) {
      NetBubbleModule(reactContext)
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      NetBubbleModule.NAME to ReactModuleInfo(
        name = NetBubbleModule.NAME,
        className = NetBubbleModule.NAME,
        canOverrideExistingModule = false,
        needsEagerInit = false,
        isCxxModule = false,
        isTurboModule = true
      )
    )
  }
}
