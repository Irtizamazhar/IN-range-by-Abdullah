import type { Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ISettings } from "@/types/settings";

export function settingsRowToApp(row: Settings): ISettings {
  const cities = row.codAvailableCities;
  return {
    shopName: row.shopName,
    whatsappNumber: row.whatsappNumber,
    codCharges: Number(row.codCharges),
    codAvailableCities: Array.isArray(cities) ? (cities as string[]) : [],
    bankAccounts: {
      meezanBank: {
        accountTitle: row.bankMeezanTitle,
        accountNumber: row.bankMeezanNumber,
      },
      hbl: {
        accountTitle: row.bankHblTitle,
        accountNumber: row.bankHblNumber,
      },
      easypaisa: { mobileNumber: row.bankEasypaisa },
      jazzCash: { mobileNumber: row.bankJazzcash },
    },
  };
}

export async function getOrCreateSettings(): Promise<ISettings> {
  let row = await prisma.settings.findFirst();
  if (!row) {
    row = await prisma.settings.create({
      data: {
        codAvailableCities: ["Karachi", "Lahore", "Islamabad"],
      },
    });
  }
  return settingsRowToApp(row);
}

export async function updateSettingsFromBody(body: ISettings): Promise<ISettings> {
  const row = await prisma.settings.findFirst();
  const data = {
    shopName: body.shopName,
    whatsappNumber: body.whatsappNumber,
    codCharges: body.codCharges,
    codAvailableCities: body.codAvailableCities,
    bankMeezanTitle: body.bankAccounts.meezanBank.accountTitle,
    bankMeezanNumber: body.bankAccounts.meezanBank.accountNumber,
    bankHblTitle: body.bankAccounts.hbl.accountTitle,
    bankHblNumber: body.bankAccounts.hbl.accountNumber,
    bankEasypaisa: body.bankAccounts.easypaisa.mobileNumber,
    bankJazzcash: body.bankAccounts.jazzCash.mobileNumber,
  };
  if (!row) {
    await prisma.settings.create({ data });
  } else {
    await prisma.settings.update({
      where: { id: row.id },
      data,
    });
  }
  return getOrCreateSettings();
}
