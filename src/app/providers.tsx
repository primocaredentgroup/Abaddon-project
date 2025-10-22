"use client";
import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth0 } from "convex/react-auth0";
import { Auth0Provider } from "@auth0/auth0-react";
import { RoleProvider } from "@/providers/RoleProvider";
import { AutoAssignSociety } from "@/components/AutoAssignSociety";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <Auth0Provider
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
      // Skippa il check del token JWT iniziale
      skipRedirectCallback={false}
    >
      <ConvexProviderWithAuth0 client={convex}>
        <RoleProvider>
          <AutoAssignSociety />
          {children}
        </RoleProvider>
      </ConvexProviderWithAuth0>
    </Auth0Provider>
  );
}
