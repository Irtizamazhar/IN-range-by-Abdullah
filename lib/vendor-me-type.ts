/** Safe vendor profile for client / JSON (no secrets). */
export type VendorMe = {
  id: string;
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  status: string;
  isEmailVerified: boolean;
  primaryCategory: string;
  businessType: string;
};
