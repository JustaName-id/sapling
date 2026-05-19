// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Vm} from "forge-std/Vm.sol";

import {UserRegistry} from "@ensv2/registry/UserRegistry.sol";
import {IPermissionedRegistry} from "@ensv2/registry/interfaces/IPermissionedRegistry.sol";
import {RegistryRolesLib} from "@ensv2/registry/libraries/RegistryRolesLib.sol";
import {IStandardRegistry} from "@ensv2/registry/interfaces/IStandardRegistry.sol";
import {LibLabel} from "@ensv2/utils/LibLabel.sol";

import {OpenRegistrar} from "../src/OpenRegistrar.sol";
import {IOpenRegistrar} from "../src/IOpenRegistrar.sol";

import {EnsV2Fixture} from "./helpers/EnsV2Fixture.sol";

contract OpenRegistrarTest is EnsV2Fixture {
    UserRegistry internal userRegistry;
    OpenRegistrar internal openRegistrar;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    bytes32 internal constant REGISTERED_EVENT_SIG =
        keccak256("Registered(uint256,address,address,string)");

    function setUp() public {
        deployEnsV2Fixture();
        userRegistry = deployUserRegistry(address(this), 1);
        openRegistrar = new OpenRegistrar(userRegistry);
        userRegistry.grantRootRoles(
            RegistryRolesLib.ROLE_REGISTRAR,
            address(openRegistrar)
        );
    }

    function test_constructor_bindsRegistry() public view {
        assertEq(address(openRegistrar.REGISTRY()), address(userRegistry));
    }

    function test_constructor_revertsWhen_registryZero() public {
        vm.expectRevert(IOpenRegistrar.ZeroRegistry.selector);
        new OpenRegistrar(IPermissionedRegistry(address(0)));
    }

    function test_metadata_exposesNameAndVersion() public view {
        assertEq(openRegistrar.NAME(), "SaplingOpenRegistrar");
        assertEq(openRegistrar.VERSION(), "1.0.0");
    }

    function test_register_mintsTokenToOwner() public {
        uint256 tokenId = openRegistrar.register("bob", BOB);

        assertEq(userRegistry.ownerOf(tokenId), BOB);
        assertEq(userRegistry.getExpiry(tokenId), type(uint64).max);
    }

    function test_register_leavesResolverUnsetForOwnerToConfigure() public {
        openRegistrar.register("bob", BOB);
        assertEq(userRegistry.getResolver("bob"), address(0));
    }

    function test_register_grantsOwnerControlOfSubname() public {
        uint256 tokenId = openRegistrar.register("bob", BOB);

        assertTrue(
            userRegistry.hasRoles(tokenId, RegistryRolesLib.ROLE_SET_RESOLVER, BOB)
        );
        assertTrue(
            userRegistry.hasRoles(tokenId, RegistryRolesLib.ROLE_SET_SUBREGISTRY, BOB)
        );
        assertTrue(
            userRegistry.hasRoles(tokenId, RegistryRolesLib.ROLE_RENEW, BOB)
        );
        assertTrue(
            userRegistry.hasRoles(tokenId, RegistryRolesLib.ROLE_UNREGISTER, BOB)
        );
    }

    function test_register_returnsPostRegenerationTokenId() public {
        uint256 returned = openRegistrar.register("bob", BOB);
        uint256 viaGetter = userRegistry.getTokenId(LibLabel.id("bob"));
        assertEq(returned, viaGetter);
    }

    function test_register_emitsRegisteredEvent() public {
        address caller = address(0xCA11E7);

        vm.recordLogs();
        vm.prank(caller);
        uint256 tokenId = openRegistrar.register("bob", BOB);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(openRegistrar)) continue;
            if (logs[i].topics[0] != REGISTERED_EVENT_SIG) continue;
            assertEq(logs[i].topics[1], bytes32(tokenId));
            assertEq(logs[i].topics[2], bytes32(uint256(uint160(BOB))));
            assertEq(logs[i].topics[3], bytes32(uint256(uint160(caller))));
            string memory label = abi.decode(logs[i].data, (string));
            assertEq(label, "bob");
            found = true;
            break;
        }
        assertTrue(found, "Registered event not emitted");
    }

    function test_register_revertsWhen_ownerZero() public {
        vm.expectRevert(IOpenRegistrar.ZeroOwner.selector);
        openRegistrar.register("bob", address(0));
    }

    function test_register_revertsWhen_registrarRoleNotGranted() public {
        UserRegistry ungrantedRegistry = deployUserRegistry(address(this), 2);
        OpenRegistrar ungrantedRegistrar = new OpenRegistrar(ungrantedRegistry);

        vm.expectRevert();
        ungrantedRegistrar.register("bob", BOB);
    }

    function test_register_revertsWhen_labelAlreadyRegistered() public {
        openRegistrar.register("bob", BOB);

        vm.expectRevert(
            abi.encodeWithSelector(IStandardRegistry.NameAlreadyRegistered.selector, "bob")
        );
        openRegistrar.register("bob", ALICE);
    }

    function test_register_callableByAnyone() public {
        address randomCaller = address(0xDEADBEEF);

        vm.prank(randomCaller);
        uint256 tokenId = openRegistrar.register("bob", BOB);

        assertEq(userRegistry.ownerOf(tokenId), BOB);
    }
}
