export function incrementalFeatures() {
  return {
    promotions: process.env.JORO_HOMEPAGE_PROMOTIONS === "true",
    chat: process.env.JORO_LIVE_CHAT === "true",
    newsletter: process.env.JORO_NEWSLETTER === "true",
    guestCheckout: process.env.JORO_GUEST_CHECKOUT === "true",
  };
}
