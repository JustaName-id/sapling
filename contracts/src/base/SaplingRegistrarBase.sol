// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IPermissionedRegistry} from "@ensv2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensv2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ensv2/registry/libraries/RegistryRolesLib.sol";

import {ISaplingRegistrar} from "../interfaces/ISaplingRegistrar.sol";

/// @title SaplingRegistrarBase
/// @notice Abstract base for Sapling registrar templates. Implements the canonical read surface.
abstract contract SaplingRegistrarBase is ISaplingRegistrar {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc ISaplingRegistrar
    IPermissionedRegistry public immutable override REGISTRY;

    uint256 private immutable _ROOT_RESOURCE;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(IPermissionedRegistry registry) {
        if (address(registry) == address(0)) revert ZeroRegistry();
        REGISTRY = registry;
        _ROOT_RESOURCE = registry.ROOT_RESOURCE();
    }

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc ISaplingRegistrar
    function available(uint256 anyId) external view returns (bool) {
        return REGISTRY.getStatus(anyId) == IPermissionedRegistry.Status.AVAILABLE;
    }

    /// @inheritdoc ISaplingRegistrar
    function isAuthorized() external view returns (bool) {
        return REGISTRY.hasRoles(_ROOT_RESOURCE, RegistryRolesLib.ROLE_REGISTRAR, address(this));
    }

    /// @inheritdoc ISaplingRegistrar
    function parent() external view returns (IRegistry parentRegistry, string memory label) {
        return REGISTRY.getParent();
    }
}
