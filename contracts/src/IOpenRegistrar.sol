// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IPermissionedRegistry} from "@ensv2/registry/interfaces/IPermissionedRegistry.sol";

/// @title IOpenRegistrar
/// @notice External interface for a per-domain Sapling OpenRegistrar instance.
///         Each instance is bound at construction to a single `UserRegistry`
///         and exposes a permissionless two-field `register(label, owner)`.
interface IOpenRegistrar {
    /// @notice Emitted when a subname is registered through this registrar.
    /// @param tokenId The ERC1155 token id the owner holds, post role-grant regeneration.
    /// @param owner   The address that owns the new subname token.
    /// @param caller  The address that initiated the registration (the registrant or relayer).
    /// @param label   The label registered (the leaf, e.g. `"bob"` for `bob.alice.eth`).
    event Registered(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed caller,
        string label
    );

    /// @notice Reverts when `owner` is the zero address.
    error ZeroOwner();

    /// @notice Reverts when the registrar is constructed with a zero registry.
    error ZeroRegistry();

    /// @notice The registry this registrar is bound to. Immutable.
    function REGISTRY() external view returns (IPermissionedRegistry);

    /// @notice Identifier of this registrar implementation.
    function NAME() external view returns (string memory);

    /// @notice Semantic version of this registrar implementation.
    function VERSION() external view returns (string memory);

    /// @notice Register a subname under the bound registry.
    ///
    /// @dev    Hardcodes the open-registrar policy:
    ///         * the new owner receives every role on their token resource,
    ///         * the resolver pointer is left unset (the new owner picks one),
    ///         * the expiry is `type(uint64).max`, since subname resolvability
    ///           is bounded by the parent's expiry via the resolution walk.
    ///         Reverts naturally via EAC if the bound registry has not granted
    ///         this contract the registrar role.
    ///
    /// @param  label The label to register, scoped to the registry's parent.
    /// @param  owner The address that will own the new subname token.
    /// @return tokenId The token id the owner holds after registration.
    function register(string calldata label, address owner)
        external
        returns (uint256 tokenId);
}
