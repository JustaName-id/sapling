// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IPermissionedRegistry} from "@ensv2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensv2/registry/interfaces/IRegistry.sol";
import {EACBaseRolesLib} from "@ensv2/access-control/libraries/EACBaseRolesLib.sol";
import {LibLabel} from "@ensv2/utils/LibLabel.sol";

import {IOpenRegistrar} from "./IOpenRegistrar.sol";

/// @title OpenRegistrar
/// @notice Permissionless per-domain registrar for ENSv2 user registries.
///         Part of the Sapling protocol.
///
/// @dev One instance per parent registry. The bound registry is set at
///      construction time and never changes. Any caller may invoke
///      `register(label, owner)`; the new owner is granted every role on
///      their token resource (full control of the subname).
///
///      The contract is stateless beyond its immutable registry reference,
///      and admin-less. There is no upgrade path and no kill switch. The
///      escape valve is the registry owner revoking the registrar role
///      from this instance and granting it to a different registrar.
contract OpenRegistrar is IOpenRegistrar {
    /// @inheritdoc IOpenRegistrar
    IPermissionedRegistry public immutable REGISTRY;

    /// @inheritdoc IOpenRegistrar
    string public constant NAME = "SaplingOpenRegistrar";

    /// @inheritdoc IOpenRegistrar
    string public constant VERSION = "1.0.0";

    constructor(IPermissionedRegistry registry) {
        if (address(registry) == address(0)) revert ZeroRegistry();
        REGISTRY = registry;
    }

    /// @inheritdoc IOpenRegistrar
    function register(string calldata label, address owner)
        external
        returns (uint256 tokenId)
    {
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
