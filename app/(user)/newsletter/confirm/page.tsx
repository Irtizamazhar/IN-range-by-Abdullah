import { NewsletterAction } from "@/components/user/NewsletterAction";
export const metadata = { title: "Newsletter confirmation", robots: { index: false, follow: false } };
export default function Page() { return <NewsletterAction action="confirm" />; }
