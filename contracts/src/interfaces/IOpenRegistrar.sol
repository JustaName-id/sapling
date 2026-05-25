// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ISaplingRegistrar} from "./ISaplingRegistrar.sol";

/// @title IOpenRegistrar
/// @notice Permissionless registrar: any caller mints any available label to any owner.
interface IOpenRegistrar is ISaplingRegistrar {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a subname is registered through this registrar.
    event Registered(
        uint256 indexed tokenId, address indexed owner, address indexed caller, string label
    );

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroOwner();

    /*//////////////////////////////////////////////////////////////
                                FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Register a subname under the bound registry.
    /// @param label The label to register.
    /// @param owner The address that will own the new subname token.
    /// @return tokenId The token id the owner holds after registration.
    function register(string calldata label, address owner) external returns (uint256 tokenId);
}
