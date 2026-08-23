import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Arty — your family's personal assistant",
  description:
    "A UI prototype of Arty, a voice-first personal assistant for the whole family. Tell Arty. Arty remembers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF8F4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
