import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skribo Essay",
  description: "Essay writing, process analytics, and professor response.",
  openGraph: {
    title: "Skribo Essay",
    description: "Writing process, analytics, and response.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skribo Essay",
    description: "Writing process, analytics, and response.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
