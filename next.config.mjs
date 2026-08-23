/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so a stray lock file further up the disk cannot
  // change how the demo builds on somebody else's machine.
  turbopack: { root: import.meta.dirname },
  // The demo is entirely static and needs no API keys, which is what makes it
  // safe to hand to a parent as a URL.
  poweredByHeader: false,
  // Next 16 writes AGENTS.md and CLAUDE.md into the project by default. This
  // repository documents itself in /docs, so keep the generated files out.
  agentRules: false,
};

export default nextConfig;
