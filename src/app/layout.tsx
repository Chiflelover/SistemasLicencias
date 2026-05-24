import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Licencias Municipales - Trujillo",
  description: "Sistema de otorgamiento de licencias municipales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
