"use client";

import {ConnectButton as RkConnectButton} from "@rainbow-me/rainbowkit";

/**
 * Styled wrapper around RainbowKit's headless `ConnectButton.Custom`. Renders
 * a rectangular `sapling-btn` for every state so the navbar stays visually
 * consistent with the rest of the app.
 */
export function ConnectButton() {
  return (
    <RkConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {opacity: 0, pointerEvents: "none", userSelect: "none"},
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="sapling-btn"
                    data-variant="primary"
                    data-size="sm"
                  >
                    Connect wallet
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="sapling-btn"
                    data-variant="secondary"
                    data-size="sm"
                    style={{
                      color: "var(--danger)",
                      borderColor: "var(--danger)",
                    }}
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="sapling-btn"
                    data-variant="secondary"
                    data-size="sm"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={chain.name ?? "Chain"}
                        src={chain.iconUrl}
                        width={14}
                        height={14}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          background: chain.iconBackground,
                        }}
                      />
                    )}
                    {chain.name}
                  </button>

                  <button
                    type="button"
                    onClick={openAccountModal}
                    className="sapling-btn"
                    data-variant="secondary"
                    data-size="sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                    <span className="font-mono">{account.displayName}</span>
                    {account.displayBalance && (
                      <span className="text-fg-3">
                        ({account.displayBalance})
                      </span>
                    )}
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                      className="opacity-60"
                    >
                      <path
                        d="M3 4.5L6 7.5L9 4.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </RkConnectButton.Custom>
  );
}
