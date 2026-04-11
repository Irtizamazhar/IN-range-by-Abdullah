import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth-options";
import { adminAuthOptions } from "@/lib/admin-auth-options";

export async function getCustomerSession() {
  return getServerSession(customerAuthOptions);
}

export async function getAdminSession() {
  return getServerSession(adminAuthOptions);
}
