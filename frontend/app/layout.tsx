import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Statement Parser — Credit Card Statement Parser",
  description:
    "Parse credit card statements from PDF or Gmail. Extract transactions and balances, export and track spending.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
