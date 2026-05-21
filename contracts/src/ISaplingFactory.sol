// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title ISaplingFactory
/// @notice Canonical entry point for deploying Sapling user registries.
interface ISaplingFactory {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a registry is deployed through this factory.
    event RegistryDeployed(address indexed admin, address indexed registry, address indexed caller);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAdmin();

    /*//////////////////////////////////////////////////////////////
                                FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice The underlying VerifiableFactory used to deploy proxies.
    function VERIFIABLE_FACTORY() external view returns (address);

    /// @notice The canonical UserRegistry implementation proxies delegate to.
    function USER_REGISTRY_IMPL() external view returns (address);

    /// @notice Identifier of this factory implementation.
    function NAME() external view returns (string memory);

    /// @notice Semantic version of this factory implementation.
    function VERSION() external view returns (string memory);

    /// @notice Deploy a UserRegistry with `msg.sender` as admin and salt namespaced to them.
    /// @param salt User-chosen salt; identifies this deploy within `msg.sender`'s namespace.
    function deployRegistry(uint256 salt) external returns (address registry);

    /// @notice Deploy a UserRegistry. Address is deterministic in `(admin, salt)`.
    /// @param admin Address granted ALL_ROLES at the registry root.
    /// @param salt Caller-chosen salt; identifies this deploy within `admin`'s namespace.
    /// @return registry The deployed UserRegistry proxy address.
    function deployRegistry(address admin, uint256 salt) external returns (address registry);
}
