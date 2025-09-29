import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/providers/ConvexProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { RoleProvider } from "@/providers/RoleProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Healthcare Ticket System",
  description: "Sistema di gestione ticket per cliniche sanitarie",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ConvexClientProvider>
          <AuthProvider>
            <RoleProvider>
              {children}
            </RoleProvider>
          </AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
