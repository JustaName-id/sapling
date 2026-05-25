// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {UserRegistry} from "@ensv2/registry/UserRegistry.sol";
import {IPermissionedRegistry} from "@ensv2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensv2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ensv2/registry/libraries/RegistryRolesLib.sol";
import {EACBaseRolesLib} from "@ensv2/access-control/libraries/EACBaseRolesLib.sol";
import {LibLabel} from "@ensv2/utils/LibLabel.sol";

import {ISaplingRegistrar} from "../src/interfaces/ISaplingRegistrar.sol";
import {SaplingRegistrarBase} from "../src/base/SaplingRegistrarBase.sol";

import {EnsV2Fixture} from "./helpers/EnsV2Fixture.sol";

/// @dev Minimal concrete subclass used to exercise SaplingRegistrarBase in
///      isolation from any specific template (OpenRegistrar etc.). It
///      exposes a single registration entry point that mints with ALL_ROLES
///      so the test fixture can drive lifecycle state.
contract TestRegistrar is SaplingRegistrarBase {
    string public constant NAME = "TestRegistrar";
    string public constant VERSION = "0.0.1";

    constructor(IPermissionedRegistry registry) SaplingRegistrarBase(registry) {}

    function registerForTest(string calldata label, address owner) external returns (uint256) {
        REGISTRY.register(
            label,
            owner,
            IRegistry(address(0)),
            address(0),
            EACBaseRolesLib.ALL_ROLES,
            type(uint64).max
        );
        return REGISTRY.getTokenId(LibLabel.id(label));
    }
}

contract SaplingRegistrarBaseTest is EnsV2Fixture {
    UserRegistry internal userRegistry;
    TestRegistrar internal registrar;

    address internal constant BOB = address(0xB0B);

    function setUp() public {
        deployEnsV2Fixture();
        userRegistry = deployUserRegistry(address(this), 1);
        registrar = new TestRegistrar(userRegistry);
    }

    function _grantRegistrarRole() internal {
        userRegistry.grantRootRoles(RegistryRolesLib.ROLE_REGISTRAR, address(registrar));
    }

    function test_constructor_revertsWhen_registryZero() public {
        vm.expectRevert(ISaplingRegistrar.ZeroRegistry.selector);
        new TestRegistrar(IPermissionedRegistry(address(0)));
    }

    function test_constructor_bindsRegistry() public view {
        assertEq(address(registrar.REGISTRY()), address(userRegistry));
    }

    function test_available_trueForUnregisteredLabel() public view {
        assertTrue(registrar.available(LibLabel.id("bob")));
    }

    function test_available_falseAfterRegistration() public {
        _grantRegistrarRole();
        registrar.registerForTest("bob", BOB);
        assertFalse(registrar.available(LibLabel.id("bob")));
    }

    function test_available_trueAfterExpiry() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        userRegistry.register(
            "bob", BOB, IRegistry(address(0)), address(0), EACBaseRolesLib.ALL_ROLES, expiry
        );
        assertFalse(registrar.available(LibLabel.id("bob")));

        vm.warp(expiry + 1);
        assertTrue(registrar.available(LibLabel.id("bob")));
    }

    function test_isAuthorized_falseBeforeRoleGrant() public view {
        assertFalse(registrar.isAuthorized());
    }

    function test_isAuthorized_trueAfterRoleGrant() public {
        _grantRegistrarRole();
        assertTrue(registrar.isAuthorized());
    }

    function test_isAuthorized_falseAfterRoleRevoke() public {
        _grantRegistrarRole();
        userRegistry.revokeRootRoles(RegistryRolesLib.ROLE_REGISTRAR, address(registrar));
        assertFalse(registrar.isAuthorized());
    }

    function test_parent_returnsUnsetBeforeSetParent() public view {
        (IRegistry parentRegistry, string memory label) = registrar.parent();
        assertEq(address(parentRegistry), address(0));
        assertEq(label, "");
    }

    function test_parent_returnsRegistrySetParent() public {
        userRegistry.setParent(ethRegistry, "alice");
        (IRegistry parentRegistry, string memory label) = registrar.parent();
        assertEq(address(parentRegistry), address(ethRegistry));
        assertEq(label, "alice");
    }
}
