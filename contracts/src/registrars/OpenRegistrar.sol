// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IPermissionedRegistry} from "@ensv2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensv2/registry/interfaces/IRegistry.sol";
import {EACBaseRolesLib} from "@ensv2/access-control/libraries/EACBaseRolesLib.sol";
import {LibLabel} from "@ensv2/utils/LibLabel.sol";

import {IOpenRegistrar} from "./IOpenRegistrar.sol";
import {ISaplingRegistrar} from "./ISaplingRegistrar.sol";
import {SaplingRegistrarBase} from "./SaplingRegistrarBase.sol";

/// @title OpenRegistrar
/// @notice Permissionless per-domain registrar for ENSv2 user registries.
contract OpenRegistrar is SaplingRegistrarBase, IOpenRegistrar {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc ISaplingRegistrar
    string public constant override NAME = "SaplingOpenRegistrar";

    /// @inheritdoc ISaplingRegistrar
    string public constant override VERSION = "1.0.0";

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(IPermissionedRegistry registry) SaplingRegistrarBase(registry) {}

    /*//////////////////////////////////////////////////////////////
                            PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IOpenRegistrar
    function register(string calldata label, address owner) external returns (uint256 tokenId) {
        if (owner == address(0)) revert ZeroOwner();

        REGISTRY.register(
            label,
            owner,
            IRegistry(address(0)),
            address(0),
            EACBaseRolesLib.ALL_ROLES,
            type(uint64).max
        );

        tokenId = REGISTRY.getTokenId(LibLabel.id(label));
        emit Registered(tokenId, owner, msg.sender, label);
    }
}
