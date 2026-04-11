import { AdminChrome } from "./AdminChrome";
import { AdminSessionProvider } from "./AdminSessionProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminSessionProvider>
      <div className="font-sans antialiased">
        <AdminChrome>{children}</AdminChrome>
      </div>
    </AdminSessionProvider>
  );
}
