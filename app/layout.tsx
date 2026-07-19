import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
});

export const metadata: Metadata = {
	title: "ATOM — Cyanotype Fast Film Filter",
	description:
		"Apply a real-time cyanotype / analog film aesthetic to your photos. Upload, tune, and save — GPU-composited, zero pixel-loop processing.",
};

export const viewport: Viewport = {
	colorScheme: "dark",
	themeColor: "#2e405d",
	userScalable: false,
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`bg-atom-bg ${geistSans.variable} ${geistMono.variable}`}
		>
			<body className="antialiased bg-atom-bg text-atom-text font-sans">
				{children}
				{process.env.NODE_ENV === "production" && <Analytics />}
			</body>
		</html>
	);
}
