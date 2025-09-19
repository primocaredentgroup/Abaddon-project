"use client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { LogIn, LogOut, User } from "lucide-react";

export function AuthButton() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
        <span className="text-sm">Caricamento...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {/* User Info */}
        <div className="flex flex-col text-right">
          <span className="text-sm font-medium text-gray-900">
            {user.name}
          </span>
          <span className="text-xs text-gray-500">
            {user.email}
          </span>
          {user.role && (
            <span className="text-xs text-blue-600 font-medium">
              {user.role.name}
            </span>
          )}
        </div>

        {/* Logout Button */}
        <a href="/api/auth/logout">
          <Button variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </a>
      </div>
    );
  }

  return (
    <a href="/api/auth/login">
      <Button className="bg-blue-600 hover:bg-blue-700">
        <LogIn className="w-4 h-4 mr-2" />
        Login con Auth0
      </Button>
    </a>
  );
}