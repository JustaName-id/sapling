// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {UserRegistry} from "@ensv2/registry/UserRegistry.sol";
import {PermissionedRegistry} from "@ensv2/registry/PermissionedRegistry.sol";
import {PermissionedResolver} from "@ensv2/resolver/PermissionedResolver.sol";
import {IRegistry} from "@ensv2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ensv2/registry/libraries/RegistryRolesLib.sol";
import {LibLabel} from "@ensv2/utils/LibLabel.sol";

import {OpenRegistrar} from "../src/OpenRegistrar.sol";
import {SaplingFactory} from "../src/SaplingFactory.sol";

import {EnsV2Fixture} from "./helpers/EnsV2Fixture.sol";

/// @dev Mirrors the exact production flow: parent name owner deploys a
///      UserRegistry proxy, a resolver proxy, and their own OpenRegistrar
///      bound to the new registry. They wire the registry under .eth, grant
///      the registrar the registrar role, and anyone mints subnames that
///      resolve via the registry walk.
contract SaplingFlowTest is EnsV2Fixture {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant BOB_RECORD = address(0xB0B0B0);

    function setUp() public {
        deployEnsV2Fixture();
        registerEthChild("alice", ALICE, PermissionedRegistry(address(0)));
    }

    function test_e2e_aliceDeploysSubregistry_bobMintsAndResolves() public {
        (
            UserRegistry aliceRegistry,
            PermissionedResolver aliceResolver,
            OpenRegistrar aliceRegistrar
        ) = _aliceDeploysAndWires();

        uint256 bobTokenId = aliceRegistrar.register("bob", BOB);
        assertEq(aliceRegistry.ownerOf(bobTokenId), BOB);

        vm.prank(BOB);
        aliceRegistry.setResolver(bobTokenId, address(aliceResolver));

        bytes32 bobNode = _namehash3("eth", "alice", "bob");
        vm.prank(ALICE);
        aliceResolver.setAddr(bobNode, BOB_RECORD);

        IRegistry ethSub = rootRegistry.getSubregistry("eth");
        IRegistry aliceSub = ethSub.getSubregistry("alice");
        address resolverAddr = aliceSub.getResolver("bob");
        address resolved = PermissionedResolver(resolverAddr).addr(bobNode);

        assertEq(address(ethSub), address(ethRegistry));
        assertEq(address(aliceSub), address(aliceRegistry));
        assertEq(resolverAddr, address(aliceResolver));
        assertEq(resolved, BOB_RECORD);
    }

    function test_e2e_subnameOwnerCanRetargetResolver() public {
        (UserRegistry aliceRegistry,, OpenRegistrar aliceRegistrar) =
            _aliceDeploysAndWires();

        uint256 bobTokenId = aliceRegistrar.register("bob", BOB);

        PermissionedResolver bobOwnResolver = deployResolver(BOB, 200);

        vm.prank(BOB);
        aliceRegistry.setResolver(bobTokenId, address(bobOwnResolver));

        assertEq(aliceRegistry.getResolver("bob"), address(bobOwnResolver));
    }

    function test_e2e_aliceCanEmancipateSubregistryByRevokingHerself() public {
        (UserRegistry aliceRegistry,,) = _aliceDeploysAndWires();

        uint256 aliceTokenId = ethRegistry.getTokenId(LibLabel.id("alice"));
        vm.prank(ALICE);
        ethRegistry.revokeRoles(
            aliceTokenId,
            RegistryRolesLib.ROLE_SET_SUBREGISTRY,
            ALICE
        );

        vm.expectRevert();
        vm.prank(ALICE);
        ethRegistry.setSubregistry(aliceTokenId, IRegistry(address(0)));

        assertEq(
            address(ethRegistry.getSubregistry("alice")),
            address(aliceRegistry)
        );
    }

    function _aliceDeploysAndWires()
        internal
        returns (
            UserRegistry aliceRegistry,
            PermissionedResolver aliceResolver,
            OpenRegistrar aliceRegistrar
        )
    {
        vm.startPrank(ALICE);
        aliceRegistry = deployUserRegistry(ALICE, 100);
        aliceResolver = deployResolver(ALICE, 101);
        aliceRegistrar = new OpenRegistrar(aliceRegistry);
        aliceRegistry.grantRootRoles(
            RegistryRolesLib.ROLE_REGISTRAR,
            address(aliceRegistrar)
        );
        vm.stopPrank();

        uint256 aliceTokenId = ethRegistry.getTokenId(LibLabel.id("alice"));
        vm.prank(ALICE);
        ethRegistry.setSubregistry(aliceTokenId, aliceRegistry);
    }

    function test_e2e_aliceDeploysThroughSaplingFactory() public {
        SaplingFactory factory = new SaplingFactory(
            address(verifiableFactory),
            address(userRegistryImpl)
        );

        vm.startPrank(ALICE);
        UserRegistry aliceRegistry = UserRegistry(factory.deployRegistry(ALICE, 1));
        OpenRegistrar aliceRegistrar = new OpenRegistrar(aliceRegistry);
        aliceRegistry.grantRootRoles(
            RegistryRolesLib.ROLE_REGISTRAR,
            address(aliceRegistrar)
        );
        vm.stopPrank();

        uint256 aliceTokenId = ethRegistry.getTokenId(LibLabel.id("alice"));
        vm.prank(ALICE);
        ethRegistry.setSubregistry(aliceTokenId, aliceRegistry);

        uint256 bobTokenId = aliceRegistrar.register("bob", BOB);

        assertEq(
            address(ethRegistry.getSubregistry("alice")),
            address(aliceRegistry)
        );
        assertEq(aliceRegistry.ownerOf(bobTokenId), BOB);
    }

    function _namehash3(
        string memory tld,
        string memory sld,
        string memory leaf
    ) internal pure returns (bytes32) {
        bytes32 node = bytes32(0);
        node = keccak256(abi.encodePacked(node, keccak256(bytes(tld))));
        node = keccak256(abi.encodePacked(node, keccak256(bytes(sld))));
        node = keccak256(abi.encodePacked(node, keccak256(bytes(leaf))));
        return node;
    }
}
