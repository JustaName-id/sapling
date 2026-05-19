import {getDefaultConfig} from "@rainbow-me/rainbowkit";
import {sepolia} from "wagmi/chains";
import {http} from "wagmi";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
if (!projectId) {
  throw new Error("NEXT_PUBLIC_REOWN_PROJECT_ID is not defined");
}

export const config = getDefaultConfig({
  appName: "Sapling",
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: true,
});
