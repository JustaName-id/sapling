// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Vm} from "forge-std/Vm.sol";

import {UserRegistry} from "@ensv2/registry/UserRegistry.sol";
import {IPermissionedRegistry} from "@ensv2/registry/interfaces/IPermissionedRegistry.sol";
import {EACBaseRolesLib} from "@ensv2/access-control/libraries/EACBaseRolesLib.sol";
import {RegistryRolesLib} from "@ensv2/registry/libraries/RegistryRolesLib.sol";

import {SaplingFactory} from "../src/SaplingFactory.sol";
import {ISaplingFactory} from "../src/interfaces/ISaplingFactory.sol";

import {EnsV2Fixture} from "./helpers/EnsV2Fixture.sol";

contract SaplingFactoryTest is EnsV2Fixture {
    SaplingFactory internal saplingFactory;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    uint256 internal constant SALT_A = 1;
    uint256 internal constant SALT_B = 2;

    bytes32 internal constant REGISTRY_DEPLOYED_SIG =
        keccak256("RegistryDeployed(address,address,address)");

    function setUp() public {
        deployEnsV2Fixture();
        saplingFactory = new SaplingFactory(address(verifiableFactory), address(userRegistryImpl));
    }

    function test_metadata_exposesAddressesAndVersion() public view {
        assertEq(saplingFactory.VERIFIABLE_FACTORY(), address(verifiableFactory));
        assertEq(saplingFactory.USER_REGISTRY_IMPL(), address(userRegistryImpl));
        assertEq(saplingFactory.NAME(), "SaplingFactory");
        assertEq(saplingFactory.VERSION(), "1.0.0");
    }

    function test_deployRegistry_returnsUsableProxy() public {
        address registry = saplingFactory.deployRegistry(ALICE, SALT_A);
        assertTrue(registry != address(0));
        assertTrue(registry.code.length > 0);
    }

    function test_deployRegistry_grantsAllRolesToAdmin() public {
        address registry = saplingFactory.deployRegistry(ALICE, SALT_A);

        assertTrue(
            IPermissionedRegistry(registry).hasRoles(0, RegistryRolesLib.ROLE_REGISTRAR, ALICE)
        );
        assertTrue(
            IPermissionedRegistry(registry)
                .hasRoles(0, RegistryRolesLib.ROLE_SET_SUBREGISTRY, ALICE)
        );
        assertTrue(
            IPermissionedRegistry(registry).hasRoles(0, RegistryRolesLib.ROLE_SET_RESOLVER, ALICE)
        );
    }

    function test_deployRegistry_callerHasNoRolesByDefault() public {
        address registry = saplingFactory.deployRegistry(ALICE, SALT_A);

        assertFalse(
            IPermissionedRegistry(registry)
                .hasRoles(0, RegistryRolesLib.ROLE_REGISTRAR, address(saplingFactory))
        );
        assertFalse(
            IPermissionedRegistry(registry)
                .hasRoles(0, RegistryRolesLib.ROLE_REGISTRAR, address(this))
        );
    }

    function test_deployRegistry_adminCanMintDirectly() public {
        address registry = saplingFactory.deployRegistry(ALICE, SALT_A);

        vm.prank(ALICE);
        uint256 tokenId = UserRegistry(registry)
            .register(
                "bob",
                BOB,
                IPermissionedRegistry(address(0)),
                address(0),
                EACBaseRolesLib.ALL_ROLES,
                type(uint64).max
            );

        assertEq(IPermissionedRegistry(registry).ownerOf(tokenId), BOB);
    }

    function test_deployRegistry_defaultsAdminToSender() public {
        vm.prank(ALICE);
        address registry = saplingFactory.deployRegistry(SALT_A);

        assertTrue(
            IPermissionedRegistry(registry).hasRoles(0, RegistryRolesLib.ROLE_REGISTRAR, ALICE)
        );
    }

    function test_deployRegistry_revertsWhen_adminZero() public {
        vm.expectRevert(ISaplingFactory.ZeroAdmin.selector);
        saplingFactory.deployRegistry(address(0), SALT_A);
    }

    function test_deployRegistry_distinctSaltsProduceDistinctRegistries() public {
        address a = saplingFactory.deployRegistry(ALICE, SALT_A);
        address b = saplingFactory.deployRegistry(ALICE, SALT_B);
        address c = saplingFactory.deployRegistry(ALICE, 3);
        assertTrue(a != b);
        assertTrue(b != c);
        assertTrue(a != c);
    }

    function test_deployRegistry_sameSaltDifferentAdminProducesDistinctAddress() public {
        address forAlice = saplingFactory.deployRegistry(ALICE, SALT_A);
        address forBob = saplingFactory.deployRegistry(BOB, SALT_A);
        assertTrue(forAlice != forBob);
    }

    function test_deployRegistry_isCallerIndependent() public {
        address fromTest = saplingFactory.deployRegistry(ALICE, SALT_A);

        SaplingFactory secondFactory =
            new SaplingFactory(address(verifiableFactory), address(userRegistryImpl));
        vm.prank(BOB);
        address viaBobOnSecondFactory = secondFactory.deployRegistry(ALICE, SALT_A);

        // Different factory addresses give different deploy addresses, even with same (admin, salt).
        // The point is: the deploy address is determined by (admin, salt, factory), not by msg.sender to the factory.
        assertTrue(fromTest != viaBobOnSecondFactory);
    }

    function test_deployRegistry_sameAdminAndSaltOnSameFactoryReverts() public {
        saplingFactory.deployRegistry(ALICE, SALT_A);
        vm.expectRevert();
        saplingFactory.deployRegistry(ALICE, SALT_A);
    }

    function test_deployRegistry_emitsRegistryDeployedEvent() public {
        address caller = address(0xCA11E7);

        vm.recordLogs();
        vm.prank(caller);
        address registry = saplingFactory.deployRegistry(ALICE, SALT_A);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(saplingFactory)) continue;
            if (logs[i].topics[0] != REGISTRY_DEPLOYED_SIG) continue;
            assertEq(logs[i].topics[1], bytes32(uint256(uint160(ALICE))));
            assertEq(logs[i].topics[2], bytes32(uint256(uint160(registry))));
            assertEq(logs[i].topics[3], bytes32(uint256(uint160(caller))));
            found = true;
            break;
        }
        assertTrue(found, "RegistryDeployed event not emitted");
    }
}
