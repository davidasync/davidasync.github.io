import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { profile } from "@/content/site";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = `${profile.name} — ${profile.role}`;

export const metadata: Metadata = {
  metadataBase: new URL("https://davidasync.github.io"),
  title,
  description: profile.tagline,
  openGraph: {
    title,
    description: profile.tagline,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: profile.tagline,
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0a0d",
};

// Runs before paint so the saved theme is applied without a flash of the wrong
// colours, and so scroll animations are only armed when scripting is on.
const bootScript = `
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  var stored = null;
  try {
    stored = localStorage.getItem("theme");
  } catch (e) {}
  root.classList.remove("dark", "black-cat");
  if (stored === "light") return;
  if (stored === "dark") {
    root.classList.add("dark");
    return;
  }
  root.classList.add("dark", "black-cat");
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
