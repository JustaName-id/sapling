// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title ISaplingFactory
/// @notice Canonical entry point for deploying Sapling user registries.
///         Bound at construction to a single `(VerifiableFactory,
///         UserRegistryImpl)` pair from the ENSv2 deployment. When ENS
///         rotates either, deploy a new SaplingFactory.
interface ISaplingFactory {
    /// @notice Emitted when a registry is deployed through this factory.
    /// @param admin    Address granted `ALL_ROLES` at the registry's root.
    /// @param registry Address of the deployed `UserRegistry` proxy.
    /// @param caller   Address that invoked `deployRegistry`.
    event RegistryDeployed(
        address indexed admin,
        address indexed registry,
        address indexed caller
    );

    /// @notice Reverts when `admin` is the zero address.
    error ZeroAdmin();

    /// @notice The underlying VerifiableFactory used to deploy proxies.
    function VERIFIABLE_FACTORY() external view returns (address);

    /// @notice The canonical UserRegistry implementation proxies delegate to.
    function USER_REGISTRY_IMPL() external view returns (address);

    /// @notice Identifier of this factory implementation.
    function NAME() external view returns (string memory);

    /// @notice Semantic version of this factory implementation.
    function VERSION() external view returns (string memory);

    /// @notice Deploy a new UserRegistry proxy for `admin`. Convenience
    ///         overload using `msg.sender` as the admin.
    /// @return registry The deployed UserRegistry proxy address.
    function deployRegistry() external returns (address registry);

    /// @notice Deploy a new UserRegistry proxy for `admin`.
    /// @dev    The new proxy is initialized so `admin` receives `ALL_ROLES`
    ///         at the root resource (full control of the registry). Reverts
    ///         with `ZeroAdmin` if admin is zero.
    /// @param  admin Address that owns the new registry.
    /// @return registry The deployed UserRegistry proxy address.
    function deployRegistry(address admin) external returns (address registry);
}
