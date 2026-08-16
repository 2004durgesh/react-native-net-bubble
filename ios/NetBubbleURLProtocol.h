#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * An NSURLProtocol that observes traffic going through NSURLSession, including
 * React Native's networking. Because RN builds its session from
 * `[NSURLSessionConfiguration defaultSessionConfiguration]`, we swizzle that
 * factory (in +install) to inject this protocol into every default config.
 *
 * The protocol is a passthrough (canInit returns NO) until +setEnabled:YES, so
 * it is inert in production.
 */
@interface NetBubbleURLProtocol : NSURLProtocol

/** Register the protocol + swizzle NSURLSessionConfiguration. Idempotent. */
+ (void)install;
+ (void)setEnabled:(BOOL)enabled;
+ (BOOL)isEnabled;
+ (void)setMaxBodyBytes:(NSInteger)bytes;

@end

NS_ASSUME_NONNULL_END
