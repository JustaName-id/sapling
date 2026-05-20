// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {VerifiableFactory} from "@ensdomains/verifiable-factory/VerifiableFactory.sol";

import {UserRegistry} from "@ensv2/registry/UserRegistry.sol";
import {EACBaseRolesLib} from "@ensv2/access-control/libraries/EACBaseRolesLib.sol";

import {ISaplingFactory} from "./ISaplingFactory.sol";

/// @title SaplingFactory
/// @notice Canonical entry point for deploying Sapling user registries.
contract SaplingFactory is ISaplingFactory {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc ISaplingFactory
    address public immutable VERIFIABLE_FACTORY;

    /// @inheritdoc ISaplingFactory
    address public immutable USER_REGISTRY_IMPL;

    /// @inheritdoc ISaplingFactory
    string public constant NAME = "SaplingFactory";

    /// @inheritdoc ISaplingFactory
    string public constant VERSION = "1.0.0";

    uint256 private _nonce;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address verifiableFactory_, address userRegistryImpl_) {
        VERIFIABLE_FACTORY = verifiableFactory_;
        USER_REGISTRY_IMPL = userRegistryImpl_;
    }

    /*//////////////////////////////////////////////////////////////
                            PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc ISaplingFactory
    function deployRegistry(address admin) public returns (address registry) {
        if (admin == address(0)) revert ZeroAdmin();

        bytes memory init =
            abi.encodeCall(UserRegistry.initialize, (admin, EACBaseRolesLib.ALL_ROLES));

        registry =
            VerifiableFactory(VERIFIABLE_FACTORY).deployProxy(USER_REGISTRY_IMPL, ++_nonce, init);

        emit RegistryDeployed(admin, registry, msg.sender);
    }

    /// @inheritdoc ISaplingFactory
    function deployRegistry() external returns (address) {
        return deployRegistry(msg.sender);
    }
}
