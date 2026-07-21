import type { Metadata } from "next";
import "./globals.css";
import GlobalHomeButton from "../components/GlobalHomeButton";
import KeepAlive from "../components/KeepAlive";

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
      <body className="min-h-screen antialiased">
        <GlobalHomeButton />
        <KeepAlive />
        {children}
      </body>
    </html>
  );
}
