import type { Metadata } from "next";
import "./globals.css";

const description = "Writing replay, process insights, and thoughtful feedback.";
const previewTitle = "Scribo — The story behind every essay.";
const previewImage = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Scribo: The story behind every essay. Writing replay. Process insights. Thoughtful feedback.",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://skribo-essay.andriisolonskyi.chatgpt.site"),
  title: "Scribo",
  description,
  icons: {
    icon: [
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon.svg?v=draft-lines", type: "image/svg+xml", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "Scribo",
    title: previewTitle,
    description,
    images: [previewImage],
  },
  twitter: {
    card: "summary_large_image",
    title: previewTitle,
    description,
    images: [previewImage],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
