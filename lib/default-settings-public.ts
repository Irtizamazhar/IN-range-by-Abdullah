import type { ISettings } from "@/types/settings";

export const fallbackSettings: ISettings = {
  bankAccounts: {
    meezanBank: { accountTitle: "—", accountNumber: "—" },
    hbl: { accountTitle: "—", accountNumber: "—" },
    easypaisa: { mobileNumber: "—" },
    jazzCash: { mobileNumber: "—" },
  },
  whatsappNumber: process.env.WHATSAPP_NUMBER || "",
  shopName: "In Range By Abdullah",
  codCharges: 150,
  codAvailableCities: ["Karachi", "Lahore", "Islamabad"],
};
