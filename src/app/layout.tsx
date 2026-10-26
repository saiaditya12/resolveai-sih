import type { Metadata } from "next";
import { ComplaintStoreProvider } from "@/components/ComplaintStoreProvider";
import { site } from "@/lib/site";
import "./globals.css";
export const metadata: Metadata = {
  title: `${site.name} — A clearer path to resolution`,
  description: site.description,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ComplaintStoreProvider>{children}</ComplaintStoreProvider>
      </body>
    </html>
  );
}
