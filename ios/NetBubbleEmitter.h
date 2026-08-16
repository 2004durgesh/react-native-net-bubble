#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Decouples the NSURLProtocol interceptor (plain Objective-C) from the
 * TurboModule (Objective-C++ that owns the Codegen event emitter). The module
 * registers a handler on start; the protocol calls `emit:` for each event.
 */
@interface NetBubbleEmitter : NSObject

+ (void)setHandler:(nullable void (^)(NSDictionary *payload))handler;
+ (void)emit:(NSDictionary *)payload;
+ (BOOL)hasHandler;

@end

NS_ASSUME_NONNULL_END
