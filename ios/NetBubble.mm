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

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeNetBubbleSpecJSI>(params);
}

+ (NSString *)moduleName {
  return @"NetBubble";
}

@end
