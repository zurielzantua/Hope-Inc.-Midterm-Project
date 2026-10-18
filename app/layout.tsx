import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hope, Inc. ERP System",
  description: "ERP landing page and authentication UI for Hope, Inc.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
