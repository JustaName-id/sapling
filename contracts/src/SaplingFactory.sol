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
    function deployRegistry(address admin, uint256 salt) public returns (address registry) {
        if (admin == address(0)) revert ZeroAdmin();

        uint256 namespacedSalt = uint256(keccak256(abi.encode(admin, salt)));
        bytes memory init =
            abi.encodeCall(UserRegistry.initialize, (admin, EACBaseRolesLib.ALL_ROLES));

        registry = VerifiableFactory(VERIFIABLE_FACTORY)
            .deployProxy(USER_REGISTRY_IMPL, namespacedSalt, init);

        emit RegistryDeployed(admin, registry, msg.sender);
    }

    /// @inheritdoc ISaplingFactory
    function deployRegistry(uint256 salt) external returns (address) {
        return deployRegistry(msg.sender, salt);
    }
}
