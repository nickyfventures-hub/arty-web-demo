import type { Config } from "tailwindcss";

/**
 * The same restrained palette as the native app: warm paper, calm ink, one
 * accent, four quiet member tints.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // The bright Arty system. Two tiers per hue, on purpose: the spec
        // shades (#4E7BFF etc.) read beautifully as fills and graphics but
        // fail WCAG AA as text on this warm background, so each hue carries
        // a -deep variant for text and buttons. check-contrast.mjs enforces
        // every pairing.
        canvas: "#FFFDF8",
        surface: "#FFFFFF",
        muted: "#F6F1E7",
        hairline: "#EAE3D6",
        ink: "#182230",
        "ink-secondary": "#5A6273",
        // Retired. A third ink level cannot reach 4.5:1 on this warm canvas
        // without becoming ink-secondary, and everything it was carrying was
        // small print that has to be readable — renewal terms, and the notes
        // saying which parts of the prototype are simulated. Aliased rather
        // than deleted so a stray `text-ink-tertiary` renders readable text
        // instead of failing silently.
        "ink-tertiary": "#5A6273",
        // Blue is Arty: action, microphone, listening. -bright for graphics
        // and large shapes, base for text and buttons.
        accent: "#4064D0",
        "accent-bright": "#4E7BFF",
        "accent-muted": "#E9EFFF",
        // Coral-deep: warm warnings and price rises. (Was a brown.)
        attention: "#A94E48",
        // Yellow: coming up / worth attention. Ink text only, never white.
        sun: "#FFD84D",
        "sun-tint": "#FFF4CC",
        // Coral: family, birthdays, people.
        coral: "#FF766D",
        "coral-deep": "#A94E48",
        "coral-tint": "#FFE4E2",
        // Green: handled, added, under control.
        leaf: "#66D6A3",
        "leaf-deep": "#39785C",
        "leaf-tint": "#DFF6EB",
        // Violet: memory and personalisation.
        violet: "#A98BFF",
        "violet-deep": "#725EAC",
        "violet-tint": "#EFE9FF",
        member: {
          teal: "#4064D0",
          plum: "#A94E48",
          amber: "#8A6420",
          sage: "#39785C",
        },
        fur: {
          light: "#E7CFB2",
          shade: "#CBAA85",
          cream: "#F7ECDD",
          ear: "#A8734A",
          "ear-shade": "#8B5C38",
        },
        waistcoat: "#333F4C",
        "waistcoat-shade": "#26303A",
        shirt: "#FAF7F2",
        bowtie: "#7A3B45",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      maxWidth: {
        phone: "430px",
      },
    },
  },
  plugins: [],
};

export default config;
