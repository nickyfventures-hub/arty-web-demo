import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Arty — demo",
  description:
    "Arty with a household already in it: the week, the shopping list, and the things Arty has noticed. Demo data, not a real family.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
