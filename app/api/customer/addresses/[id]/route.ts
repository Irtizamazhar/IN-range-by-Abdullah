import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { addressSchema } from "@/lib/customer-address-schema";
import { addressSelect, addressTransaction, ensureDefaultAddress } from "@/lib/customer-address-service";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function PATCH(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const c = await customerActor(); const input = addressSchema.partial().parse(await request.json());
  return addressTransaction(c.id, async tx => {
    if (!await tx.customerAddress.findFirst({ where: { id: params.id, customerId: c.id }, select: { id: true } })) throw new ApiError(404, "Address not found.");
    if (input.isDefault) await tx.customerAddress.updateMany({ where: { customerId: c.id, isDefault: true }, data: { isDefault: false } });
    await tx.customerAddress.update({ where: { id: params.id, customerId: c.id }, data: input });
    await ensureDefaultAddress(tx, c.id, input.isDefault === false ? params.id : undefined);
    return { address: await tx.customerAddress.findUnique({ where: { id: params.id }, select: addressSelect }) };
  });
}); }
export async function DELETE(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const c = await customerActor();
  return addressTransaction(c.id, async tx => {
    const result = await tx.customerAddress.deleteMany({ where: { id: params.id, customerId: c.id } });
    if (!result.count) throw new ApiError(404, "Address not found.");
    await ensureDefaultAddress(tx, c.id); return { ok: true };
  });
}); }