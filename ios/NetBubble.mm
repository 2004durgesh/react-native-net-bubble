#import "NetBubble.h"
#import "NetBubbleEmitter.h"
#import "NetBubbleURLProtocol.h"

@implementation NetBubble

- (void)start {
  [NetBubbleURLProtocol install];
  [NetBubbleURLProtocol setEnabled:YES];

  __weak NetBubble *weakSelf = self;
  [NetBubbleEmitter setHandler:^(NSDictionary *payload) {
    NetBubble *strongSelf = weakSelf;
    if (strongSelf != nil) {
      [strongSelf emitOnNetworkEvent:payload];
    }
  }];
}

- (void)stop {
  [NetBubbleURLProtocol setEnabled:NO];
  [NetBubbleEmitter setHandler:nil];
}

- (NSNumber *)isRunning {
  return @([NetBubbleURLProtocol isEnabled]);
}

- (void)setMaxBodyBytes:(double)bytes {
  [NetBubbleURLProtocol setMaxBodyBytes:(NSInteger)bytes];
}

/**
 * Read the composed Hermes+Metro source map baked into the app bundle by the
 * netbubble-source-maps Xcode run-script phase. Returns an empty string when
 * the file is absent (debug builds / production builds that skip the script).
 */
- (void)readBundledSourceMap:(RCTPromiseResolveBlock)resolve
                      reject:(__unused RCTPromiseRejectBlock)reject {
  NSString *path = [[NSBundle mainBundle] pathForResource:@"netbubble-source-map"
                                                   ofType:@"json"];
  if (path == nil) {
    resolve(@"");
    return;
  }
  NSError *error = nil;
  NSString *content = [NSString stringWithContentsOfFile:path
                                                encoding:NSUTF8StringEncoding
                                                   error:&error];
  resolve(content ?: @"");
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeNetBubbleSpecJSI>(params);
}

+ (NSString *)moduleName {
  return @"NetBubble";
}

@end
