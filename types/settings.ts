/** App/API shape for shop settings (matches checkout, footer, admin). */
export interface IBankPair {
  accountTitle: string;
  accountNumber: string;
}

export interface IMobileWallet {
  mobileNumber: string;
}

export interface ISettings {
  bankAccounts: {
    meezanBank: IBankPair;
    hbl: IBankPair;
    easypaisa: IMobileWallet;
    jazzCash: IMobileWallet;
  };
  whatsappNumber: string;
  shopName: string;
  codCharges: number;
  codAvailableCities: string[];
}
