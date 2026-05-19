"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {RainbowKitProvider} from "@rainbow-me/rainbowkit";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {type ReactNode} from "react";
import {WagmiProvider} from "wagmi";

import {config} from "@/config";

const queryClient = new QueryClient();

export default function ContextProvider({children}: {children: ReactNode}) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
