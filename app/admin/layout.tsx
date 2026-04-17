import { AdminChrome } from "./AdminChrome";
import { AdminSessionProvider } from "./AdminSessionProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminSessionProvider>
      <AdminChrome>{children}</AdminChrome>
    </AdminSessionProvider>
  );
}
