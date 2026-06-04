import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import localFont from "next/font/local";
import { darkTheme } from "@/theme/config";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import "./globals.css";

const dmSans = localFont({
  src: [
    { path: "../../public/fonts/DMSans-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/DMSans-Medium.ttf", weight: "500" },
    { path: "../../public/fonts/DMSans-Bold.ttf", weight: "700" },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: [
    { path: "../../public/fonts/SpaceGrotesk-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/SpaceGrotesk-Medium.ttf", weight: "500" },
    { path: "../../public/fonts/SpaceGrotesk-SemiBold.ttf", weight: "600" },
    { path: "../../public/fonts/SpaceGrotesk-Bold.ttf", weight: "700" },
  ],
  variable: "--font-space-grotesk",
  display: "swap",
});

const firaCode = localFont({
  src: [
    { path: "../../public/fonts/FiraCode-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/FiraCode-Medium.ttf", weight: "500" },
  ],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LocateAnything - Visual Grounding Platform",
  description: "AI-powered visual grounding and object detection platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`h-full ${dmSans.variable} ${spaceGrotesk.variable} ${firaCode.variable}`}
    >
      <body className="min-h-full">
        <ErrorBoundary>
          <AntdRegistry>
            <ConfigProvider theme={darkTheme}>
              {children}
            </ConfigProvider>
          </AntdRegistry>
        </ErrorBoundary>
      </body>
    </html>
  );
}
