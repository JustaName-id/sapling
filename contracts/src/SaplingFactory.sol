// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {VerifiableFactory} from "@ensdomains/verifiable-factory/VerifiableFactory.sol";

import {UserRegistry} from "@ensv2/registry/UserRegistry.sol";
import {EACBaseRolesLib} from "@ensv2/access-control/libraries/EACBaseRolesLib.sol";

import {ISaplingFactory} from "./ISaplingFactory.sol";

/// @title SaplingFactory
/// @notice Canonical entry point for deploying Sapling user registries.
///
/// @dev    Bound at construction to a `(VerifiableFactory, UserRegistry impl)`
///         pair from the ENSv2 staging or mainnet deployment. The factory is
///         admin-less, has no upgrade path, and exposes a single method:
///         `deployRegistry(admin)`. Internally it manages a monotonically
///         increasing nonce so the caller never has to think about CREATE2
///         salt collisions; addresses are not predictable before deployment,
///         which is fine for our two-transaction deploy flow (deploy
///         registry, then in a follow-up tx deploy and wire the registrar).
///
///         If ENS rotates either dependency, deploy a new SaplingFactory at a
///         new canonical address and migrate the frontend to it.
contract SaplingFactory is ISaplingFactory {
    /// @inheritdoc ISaplingFactory
    address public immutable VERIFIABLE_FACTORY;

    /// @inheritdoc ISaplingFactory
    address public immutable USER_REGISTRY_IMPL;

    /// @inheritdoc ISaplingFactory
    string public constant NAME = "SaplingFactory";

    /// @inheritdoc ISaplingFactory
    string public constant VERSION = "1.0.0";

    /// @dev Monotonic per-factory nonce used to derive a unique
    ///      VerifiableFactory salt for each deployment.
    uint256 private _nonce;

    constructor(address verifiableFactory_, address userRegistryImpl_) {
        VERIFIABLE_FACTORY = verifiableFactory_;
        USER_REGISTRY_IMPL = userRegistryImpl_;
    }

    /// @inheritdoc ISaplingFactory
    function deployRegistry(address admin) public returns (address registry) {
        if (admin == address(0)) revert ZeroAdmin();

        bytes memory init = abi.encodeCall(
            UserRegistry.initialize,
            (admin, EACBaseRolesLib.ALL_ROLES)
        );

        registry = VerifiableFactory(VERIFIABLE_FACTORY).deployProxy(
            USER_REGISTRY_IMPL,
            ++_nonce,
            init
        );

        emit RegistryDeployed(admin, registry, msg.sender);
    }

    /// @inheritdoc ISaplingFactory
    function deployRegistry() external returns (address) {
        return deployRegistry(msg.sender);
    }
}
