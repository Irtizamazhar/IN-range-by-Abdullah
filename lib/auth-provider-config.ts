export function customerProviderAvailability() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    facebook: Boolean(process.env.FACEBOOK_CLIENT_ID?.trim() && process.env.FACEBOOK_CLIENT_SECRET?.trim()),
  };
}