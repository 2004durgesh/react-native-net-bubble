package com.netbubble

import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Headers
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okio.Buffer
import org.json.JSONObject
import java.nio.charset.Charset
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/**
 * An OkHttp application interceptor installed onto React Native's own OkHttp
 * client (via [OkHttpClientProvider]). Because it sits at the application layer
 * it observes the fully-formed request and the decompressed response, and it
 * catches everything that goes through RN networking — `fetch`, `XMLHttpRequest`
 * and native SDKs that reuse the RN client.
 *
 * okhttp3 / okio are provided transitively (as `api`) by `react-android`, so no
 * extra Gradle dependency is required.
 */
object NetBubbleInterceptor : okhttp3.Interceptor {
  @Volatile
  var enabled: Boolean = false

  @Volatile
  var maxBodyBytes: Long = 1_000_000L

  private val installed = AtomicBoolean(false)

  /**
   * Register this interceptor on the RN OkHttp client. Idempotent, and safe to
   * call unconditionally at startup: when [enabled] is false the interceptor is
   * a passthrough, so it costs nothing in production.
   */
  fun install() {
    if (!installed.compareAndSet(false, true)) {
      return
    }
    OkHttpClientProvider.setOkHttpClientFactory(
      object : OkHttpClientFactory {
        override fun createNewNetworkModuleClient(): OkHttpClient {
          return OkHttpClientProvider.createClientBuilder()
            .addInterceptor(NetBubbleInterceptor)
            .build()
        }
      }
    )
  }

  override fun intercept(chain: okhttp3.Interceptor.Chain): Response {
    val request = chain.request()
    if (!enabled) {
      return chain.proceed(request)
    }

    val id = UUID.randomUUID().toString()
    val startTime = System.currentTimeMillis()
    val method = request.method
    val url = request.url.toString()

    val (requestBody, requestTruncated) = readRequestBody(request)
    NetBubbleEmitter.emitRequest(
      id,
      method,
      url,
      headersToJson(request.headers),
      requestBody,
      requestTruncated,
      startTime,
    )

    val response: Response =
      try {
        chain.proceed(request)
      } catch (e: Exception) {
        val endTime = System.currentTimeMillis()
        NetBubbleEmitter.emitError(
          id,
          method,
          url,
          e.message ?: e.toString(),
          startTime,
          endTime,
        )
        throw e
      }

    val endTime = System.currentTimeMillis()
    val contentType = response.body?.contentType()?.toString() ?: ""
    val (responseBody, responseTruncated) = readResponseBody(response, contentType)

    NetBubbleEmitter.emitResponse(
      id,
      method,
      url,
      response.code,
      response.message,
      headersToJson(response.headers),
      responseBody,
      responseTruncated,
      contentType,
      startTime,
      endTime,
    )
    return response
  }

  private fun headersToJson(headers: Headers): String {
    val json = JSONObject()
    for (i in 0 until headers.size) {
      json.put(headers.name(i), headers.value(i))
    }
    return json.toString()
  }

  private fun readRequestBody(request: Request): Pair<String, Boolean> {
    val body = request.body ?: return Pair("", false)
    return try {
      if (body.isDuplex() || body.isOneShot()) {
        return Pair("<stream>", false)
      }
      val contentType = body.contentType()
      if (isBinary(contentType?.toString())) {
        return Pair("<binary body>", false)
      }
      val buffer = Buffer()
      body.writeTo(buffer)
      val charset = contentType?.charset() ?: Charsets.UTF_8
      readFromBuffer(buffer, charset)
    } catch (e: Exception) {
      Pair("", false)
    }
  }

  private fun readResponseBody(
    response: Response,
    contentType: String,
  ): Pair<String, Boolean> {
    return try {
      if (isBinary(contentType)) {
        return Pair("<binary body>", false)
      }
      val peek = response.peekBody(maxBodyBytes)
      val text = peek.string()
      val contentLength = response.body?.contentLength() ?: -1L
      val truncated =
        contentLength > maxBodyBytes ||
          (contentLength == -1L && text.toByteArray().size.toLong() >= maxBodyBytes)
      Pair(text, truncated)
    } catch (e: Exception) {
      Pair("", false)
    }
  }

  private fun readFromBuffer(buffer: Buffer, charset: Charset): Pair<String, Boolean> {
    val size = buffer.size
    val limit = if (size > maxBodyBytes) maxBodyBytes else size
    val text = buffer.readString(limit, charset)
    return Pair(text, size > maxBodyBytes)
  }

  private fun isBinary(contentType: String?): Boolean {
    if (contentType == null) {
      return false
    }
    val ct = contentType.lowercase()
    return ct.startsWith("image/") ||
      ct.startsWith("video/") ||
      ct.startsWith("audio/") ||
      ct.startsWith("font/") ||
      ct.contains("octet-stream") ||
      ct.contains("protobuf") ||
      ct.contains("grpc") ||
      ct.contains("zip") ||
      ct.contains("pdf")
  }
}
