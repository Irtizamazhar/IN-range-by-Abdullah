import { redirect } from "next/navigation";
export default function AccountAlias() { redirect("/account?tab=saved"); }