"use client";
import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { RoleProvider } from "@/providers/RoleProvider";
import { UserProvider } from "@auth0/nextjs-auth0/client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <UserProvider>
      <ConvexProvider client={convex}>
        <RoleProvider>
          {children}
        </RoleProvider>
      </ConvexProvider>
    </UserProvider>
  );
}
