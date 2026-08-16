package com.netbubble

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.lang.ref.WeakReference

/**
 * Bridges the OkHttp interceptor (which runs on arbitrary network threads and
 * has no React context) to the active [NetBubbleModule], which owns the Codegen
 * event emitter. Holds only a weak reference so a torn-down bridge can be GC'd.
 */
object NetBubbleEmitter {
  @Volatile
  private var moduleRef: WeakReference<NetBubbleModule>? = null

  fun attach(module: NetBubbleModule) {
    moduleRef = WeakReference(module)
  }

  fun detach(module: NetBubbleModule) {
    if (moduleRef?.get() === module) {
      moduleRef = null
    }
  }

  fun emitRequest(
    id: String,
    method: String,
    url: String,
    requestHeadersJson: String,
    requestBody: String,
    requestBodyTruncated: Boolean,
    startTime: Long,
  ) {
    emit(
      id = id,
      phase = "request",
      method = method,
      url = url,
      requestHeadersJson = requestHeadersJson,
      requestBody = requestBody,
      requestBodyTruncated = requestBodyTruncated,
      startTime = startTime,
    )
  }

  fun emitResponse(
    id: String,
    method: String,
    url: String,
    status: Int,
    statusText: String,
    responseHeadersJson: String,
    responseBody: String,
    responseBodyTruncated: Boolean,
    contentType: String,
    startTime: Long,
    endTime: Long,
  ) {
    emit(
      id = id,
      phase = "response",
      method = method,
      url = url,
      status = status,
      statusText = statusText,
      responseHeadersJson = responseHeadersJson,
      responseBody = responseBody,
      responseBodyTruncated = responseBodyTruncated,
      contentType = contentType,
      startTime = startTime,
      endTime = endTime,
      duration = endTime - startTime,
    )
  }

  fun emitError(
    id: String,
    method: String,
    url: String,
    error: String,
    startTime: Long,
    endTime: Long,
  ) {
    emit(
      id = id,
      phase = "error",
      method = method,
      url = url,
      error = error,
      startTime = startTime,
      endTime = endTime,
      duration = endTime - startTime,
    )
  }

  @Suppress("LongParameterList")
  private fun emit(
    id: String,
    phase: String,
    method: String,
    url: String,
    requestHeadersJson: String = "",
    requestBody: String = "",
    requestBodyTruncated: Boolean = false,
    status: Int = 0,
    statusText: String = "",
    responseHeadersJson: String = "",
    responseBody: String = "",
    responseBodyTruncated: Boolean = false,
    contentType: String = "",
    startTime: Long = 0L,
    endTime: Long = 0L,
    duration: Long = 0L,
    error: String = "",
  ) {
    val module = moduleRef?.get() ?: return
    val map: WritableMap = Arguments.createMap()
    map.putString("id", id)
    map.putString("phase", phase)
    map.putString("method", method)
    map.putString("url", url)
    map.putString("requestHeadersJson", requestHeadersJson)
    map.putString("requestBody", requestBody)
    map.putBoolean("requestBodyTruncated", requestBodyTruncated)
    map.putDouble("status", status.toDouble())
    map.putString("statusText", statusText)
    map.putString("responseHeadersJson", responseHeadersJson)
    map.putString("responseBody", responseBody)
    map.putBoolean("responseBodyTruncated", responseBodyTruncated)
    map.putString("contentType", contentType)
    map.putDouble("startTime", startTime.toDouble())
    map.putDouble("endTime", endTime.toDouble())
    map.putDouble("duration", duration.toDouble())
    map.putString("error", error)
    map.putString("platform", "android")
    module.dispatchEvent(map)
  }
}
