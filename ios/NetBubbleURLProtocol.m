#import "NetBubbleURLProtocol.h"
#import "NetBubbleEmitter.h"
#import <objc/runtime.h>

static NSString *const kNetBubbleHandledKey = @"NetBubbleHandled";
static BOOL _enabled = NO;
static NSInteger _maxBodyBytes = 1000000;

#pragma mark - NSURLSessionConfiguration swizzle

@interface NSURLSessionConfiguration (NetBubble)
+ (NSURLSessionConfiguration *)netbubble_defaultSessionConfiguration;
@end

@implementation NSURLSessionConfiguration (NetBubble)
+ (NSURLSessionConfiguration *)netbubble_defaultSessionConfiguration {
  // After swizzling, this call resolves to the original implementation.
  NSURLSessionConfiguration *config = [self netbubble_defaultSessionConfiguration];
  NSMutableArray *protocols =
      [NSMutableArray arrayWithObject:[NetBubbleURLProtocol class]];
  if (config.protocolClasses != nil) {
    [protocols addObjectsFromArray:config.protocolClasses];
  }
  config.protocolClasses = protocols;
  return config;
}
@end

#pragma mark - Helpers

static BOOL NetBubbleIsBinaryContentType(NSString *contentType) {
  if (contentType == nil) {
    return NO;
  }
  NSString *ct = contentType.lowercaseString;
  return [ct hasPrefix:@"image/"] || [ct hasPrefix:@"video/"] ||
         [ct hasPrefix:@"audio/"] || [ct hasPrefix:@"font/"] ||
         [ct containsString:@"octet-stream"] || [ct containsString:@"protobuf"] ||
         [ct containsString:@"grpc"] || [ct containsString:@"zip"] ||
         [ct containsString:@"pdf"];
}

static NSString *NetBubbleJSONString(NSDictionary *dict) {
  if (dict == nil) {
    return @"{}";
  }
  NSError *error = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:0 error:&error];
  if (data == nil || error != nil) {
    return @"{}";
  }
  NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  return json ?: @"{}";
}

#pragma mark - NetBubbleURLProtocol

@interface NetBubbleURLProtocol () <NSURLSessionDataDelegate>
@property (nonatomic, strong) NSURLSession *session;
@property (nonatomic, strong) NSURLSessionDataTask *dataTask;
@property (nonatomic, strong) NSMutableData *responseData;
@property (nonatomic, strong) NSURLResponse *capturedResponse;
@property (nonatomic, copy) NSString *requestId;
@property (nonatomic, assign) double startTimeMs;
@end

@implementation NetBubbleURLProtocol

+ (void)install {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    [NSURLProtocol registerClass:[NetBubbleURLProtocol class]];

    Class cls = [NSURLSessionConfiguration class];
    Method originalMethod =
        class_getClassMethod(cls, @selector(defaultSessionConfiguration));
    Method swizzledMethod =
        class_getClassMethod(cls, @selector(netbubble_defaultSessionConfiguration));
    if (originalMethod != NULL && swizzledMethod != NULL) {
      method_exchangeImplementations(originalMethod, swizzledMethod);
    }
  });
}

+ (void)setEnabled:(BOOL)enabled {
  _enabled = enabled;
}

+ (BOOL)isEnabled {
  return _enabled;
}

+ (void)setMaxBodyBytes:(NSInteger)bytes {
  if (bytes > 0) {
    _maxBodyBytes = bytes;
  }
}

+ (BOOL)canInitWithRequest:(NSURLRequest *)request {
  if (!_enabled) {
    return NO;
  }
  NSString *scheme = request.URL.scheme.lowercaseString;
  if (![scheme isEqualToString:@"http"] && ![scheme isEqualToString:@"https"]) {
    return NO;
  }
  if ([NSURLProtocol propertyForKey:kNetBubbleHandledKey inRequest:request] != nil) {
    return NO;
  }
  return YES;
}

+ (NSURLRequest *)canonicalRequestForRequest:(NSURLRequest *)request {
  return request;
}

+ (BOOL)requestIsCacheEquivalent:(NSURLRequest *)a toRequest:(NSURLRequest *)b {
  return [super requestIsCacheEquivalent:a toRequest:b];
}

- (void)startLoading {
  NSMutableURLRequest *mutableRequest = [self.request mutableCopy];
  [NSURLProtocol setProperty:@YES
                      forKey:kNetBubbleHandledKey
                   inRequest:mutableRequest];

  self.requestId = [[NSUUID UUID] UUIDString];
  self.startTimeMs = [[NSDate date] timeIntervalSince1970] * 1000.0;
  self.responseData = [NSMutableData data];

  [self emitRequest];

  NSURLSessionConfiguration *config =
      [NSURLSessionConfiguration defaultSessionConfiguration];
  self.session = [NSURLSession sessionWithConfiguration:config
                                              delegate:self
                                         delegateQueue:nil];
  self.dataTask = [self.session dataTaskWithRequest:mutableRequest];
  [self.dataTask resume];
}

- (void)stopLoading {
  [self.dataTask cancel];
  [self.session invalidateAndCancel];
  self.session = nil;
}

#pragma mark NSURLSessionDataDelegate

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
didReceiveResponse:(NSURLResponse *)response
 completionHandler:(void (^)(NSURLSessionResponseDisposition))completionHandler {
  self.capturedResponse = response;
  [self.client URLProtocol:self
        didReceiveResponse:response
        cacheStoragePolicy:NSURLCacheStorageNotAllowed];
  completionHandler(NSURLSessionResponseAllow);
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data {
  NSUInteger cap = (NSUInteger)_maxBodyBytes;
  if (self.responseData.length < cap) {
    NSUInteger remaining = cap - self.responseData.length;
    if (data.length <= remaining) {
      [self.responseData appendData:data];
    } else {
      [self.responseData appendData:[data subdataWithRange:NSMakeRange(0, remaining)]];
    }
  }
  [self.client URLProtocol:self didLoadData:data];
}

- (void)URLSession:(NSURLSession *)session
              task:(NSURLSessionTask *)task
didCompleteWithError:(NSError *)error {
  if (error != nil) {
    [self.client URLProtocol:self didFailWithError:error];
    [self emitError:error.localizedDescription];
  } else {
    [self.client URLProtocolDidFinishLoading:self];
    [self emitResponse];
  }
  [self.session finishTasksAndInvalidate];
  self.session = nil;
}

#pragma mark Emitters

- (void)emitRequest {
  NSData *body = self.request.HTTPBody;
  NSString *contentType = [self.request valueForHTTPHeaderField:@"Content-Type"];
  NSString *bodyText = @"";
  BOOL truncated = NO;

  if (NetBubbleIsBinaryContentType(contentType)) {
    bodyText = @"<binary body>";
  } else if (body != nil) {
    truncated = body.length > (NSUInteger)_maxBodyBytes;
    NSData *slice = truncated
        ? [body subdataWithRange:NSMakeRange(0, (NSUInteger)_maxBodyBytes)]
        : body;
    bodyText = [[NSString alloc] initWithData:slice encoding:NSUTF8StringEncoding] ?: @"";
  } else if (self.request.HTTPBodyStream != nil) {
    bodyText = @"<stream>";
  }

  [NetBubbleEmitter emit:@{
    @"id" : self.requestId,
    @"phase" : @"request",
    @"method" : self.request.HTTPMethod ?: @"GET",
    @"url" : self.request.URL.absoluteString ?: @"",
    @"requestHeadersJson" : NetBubbleJSONString(self.request.allHTTPHeaderFields ?: @{}),
    @"requestBody" : bodyText,
    @"requestBodyTruncated" : @(truncated),
    @"status" : @0,
    @"statusText" : @"",
    @"responseHeadersJson" : @"{}",
    @"responseBody" : @"",
    @"responseBodyTruncated" : @NO,
    @"contentType" : @"",
    @"startTime" : @(self.startTimeMs),
    @"endTime" : @0,
    @"duration" : @0,
    @"error" : @"",
    @"platform" : @"ios",
  }];
}

- (void)emitResponse {
  NSHTTPURLResponse *http =
      [self.capturedResponse isKindOfClass:[NSHTTPURLResponse class]]
          ? (NSHTTPURLResponse *)self.capturedResponse
          : nil;
  NSInteger status = http != nil ? http.statusCode : 0;
  NSString *contentType =
      http != nil ? (http.allHeaderFields[@"Content-Type"] ?: @"")
                  : (self.capturedResponse.MIMEType ?: @"");

  NSString *bodyText = @"";
  BOOL truncated = NO;
  if (NetBubbleIsBinaryContentType(contentType)) {
    bodyText = @"<binary body>";
  } else {
    long long expected = self.capturedResponse.expectedContentLength;
    truncated = (expected > (long long)_maxBodyBytes) ||
                (self.responseData.length >= (NSUInteger)_maxBodyBytes);
    bodyText = [[NSString alloc] initWithData:self.responseData
                                     encoding:NSUTF8StringEncoding]
                   ?: @"";
  }

  double endTime = [[NSDate date] timeIntervalSince1970] * 1000.0;

  [NetBubbleEmitter emit:@{
    @"id" : self.requestId,
    @"phase" : @"response",
    @"method" : self.request.HTTPMethod ?: @"GET",
    @"url" : self.request.URL.absoluteString ?: @"",
    @"requestHeadersJson" : @"{}",
    @"requestBody" : @"",
    @"requestBodyTruncated" : @NO,
    @"status" : @(status),
    @"statusText" : [NSHTTPURLResponse localizedStringForStatusCode:status] ?: @"",
    @"responseHeadersJson" : NetBubbleJSONString(http != nil ? http.allHeaderFields : @{}),
    @"responseBody" : bodyText,
    @"responseBodyTruncated" : @(truncated),
    @"contentType" : contentType,
    @"startTime" : @(self.startTimeMs),
    @"endTime" : @(endTime),
    @"duration" : @(endTime - self.startTimeMs),
    @"error" : @"",
    @"platform" : @"ios",
  }];
}

- (void)emitError:(NSString *)message {
  double endTime = [[NSDate date] timeIntervalSince1970] * 1000.0;
  [NetBubbleEmitter emit:@{
    @"id" : self.requestId,
    @"phase" : @"error",
    @"method" : self.request.HTTPMethod ?: @"GET",
    @"url" : self.request.URL.absoluteString ?: @"",
    @"requestHeadersJson" : @"{}",
    @"requestBody" : @"",
    @"requestBodyTruncated" : @NO,
    @"status" : @0,
    @"statusText" : @"",
    @"responseHeadersJson" : @"{}",
    @"responseBody" : @"",
    @"responseBodyTruncated" : @NO,
    @"contentType" : @"",
    @"startTime" : @(self.startTimeMs),
    @"endTime" : @(endTime),
    @"duration" : @(endTime - self.startTimeMs),
    @"error" : message ?: @"Request failed",
    @"platform" : @"ios",
  }];
}

@end
