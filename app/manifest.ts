import type { MetadataRoute } from "next";

/**
 * The web app manifest is what makes "Add to Home Screen" install Arty as an
 * app: its own icon, its own name, full screen with no browser chrome. This
 * is the test build for phones until TestFlight exists.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arty",
    short_name: "Arty",
    description: "Your family's personal assistant. In your pocket.",
    // The installed app is YOUR household: onboarding first time, your own
    // data after that. The fixture demo stays at /demo for sharing.
    start_url: "/",
    display: "standalone",
    background_color: "#FFFDF8",
    theme_color: "#FFFDF8",
    icons: [
      { src: "/icon.png", sizes: "1024x1024", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
  };
}
