"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      } else {
        console.error("Error al cerrar sesión");
      }
    } catch (error) {
      console.error("Error de red al cerrar sesión", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-700/50 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition duration-200 cursor-pointer"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Cerrando sesión...
        </>
      ) : (
        <>
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </>
      )}
    </button>
  );
}
