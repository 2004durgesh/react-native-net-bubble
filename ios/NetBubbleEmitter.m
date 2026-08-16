#import "NetBubbleEmitter.h"

@implementation NetBubbleEmitter

static void (^_handler)(NSDictionary *) = nil;

+ (void)setHandler:(void (^)(NSDictionary *))handler {
  @synchronized(self) {
    _handler = [handler copy];
  }
}

+ (BOOL)hasHandler {
  @synchronized(self) {
    return _handler != nil;
  }
}

+ (void)emit:(NSDictionary *)payload {
  void (^handler)(NSDictionary *) = nil;
  @synchronized(self) {
    handler = _handler;
  }
  if (handler != nil) {
    handler(payload);
  }
}

@end
