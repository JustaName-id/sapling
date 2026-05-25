// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IPermissionedRegistry} from "@ensv2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensv2/registry/interfaces/IRegistry.sol";

/// @title ISaplingRegistrar
/// @notice Standard read surface every Sapling registrar template satisfies.
interface ISaplingRegistrar {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroRegistry();

    /*//////////////////////////////////////////////////////////////
                                FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice The registry this registrar is bound to.
    function REGISTRY() external view returns (IPermissionedRegistry);

    /// @notice Identifier of this registrar implementation.
    function NAME() external view returns (string memory);

    /// @notice Semantic version of this registrar implementation.
    function VERSION() external view returns (string memory);

    /// @notice Whether a name is currently registrable under this registrar.
    /// @param anyId The labelhash, token id, or resource.
    function available(uint256 anyId) external view returns (bool);

    /// @notice Whether this contract holds the registrar role at the bound registry.
    function isAuthorized() external view returns (bool);

    /// @notice The canonical parent registry and label this registry is wired under.
    function parent() external view returns (IRegistry parentRegistry, string memory label);
}
