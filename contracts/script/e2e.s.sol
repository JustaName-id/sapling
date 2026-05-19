// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

import {UserRegistry} from "@ensv2/registry/UserRegistry.sol";
import {PermissionedRegistry} from "@ensv2/registry/PermissionedRegistry.sol";
import {IPermissionedRegistry} from "@ensv2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensv2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ensv2/registry/libraries/RegistryRolesLib.sol";
import {LibLabel} from "@ensv2/utils/LibLabel.sol";

import {SaplingFactory} from "../src/SaplingFactory.sol";
import {OpenRegistrar} from "../src/OpenRegistrar.sol";

/// @notice End-to-end Sapling deploy for the `leooo.eth` parent name on
///         Sepolia, exercising the full SaplingFactory flow. Deploys the
///         SaplingFactory, uses it to deploy a UserRegistry, deploys an
///         OpenRegistrar bound to that registry, wires roles + the parent's
///         subregistry pointer, and mints a test subname.
contract DeployLeoooEth is Script {
    address constant ETH_REGISTRY        = 0x796fFF2E907449be8D5921BCC215B1b76D89d080;
    address constant VERIFIABLE_FACTORY  = 0x9240c5F31D747d60b3d9Aed2F57995094342B1Ed;
    address constant USER_REGISTRY_IMPL  = 0xEa93AFf7375E8176053ab6ab36B57cab53CbF702;

    string  constant PARENT_LABEL        = "leooo";
    string  constant TEST_SUBNAME        = "factory";

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(pk);

        console2.log("== Sapling deploy for leooo.eth ==");
        console2.log("deployer EOA:        ", admin);
        console2.log("eth registry:        ", ETH_REGISTRY);
        console2.log("verifiable factory:  ", VERIFIABLE_FACTORY);
        console2.log("user registry impl:  ", USER_REGISTRY_IMPL);

        uint256 parentTokenId = PermissionedRegistry(ETH_REGISTRY)
            .getTokenId(LibLabel.id(PARENT_LABEL));
        address parentOwner = PermissionedRegistry(ETH_REGISTRY).ownerOf(parentTokenId);
        require(parentOwner == admin, "deployer does not own leooo.eth");
        console2.log("leooo.eth tokenId:   ", parentTokenId);
        console2.log("leooo.eth owner ok:  ", parentOwner);

        vm.startBroadcast(pk);

        // 1. Deploy the canonical SaplingFactory bound to the current
        //    staging VerifiableFactory + UserRegistry implementation.
        SaplingFactory factory = new SaplingFactory(
            VERIFIABLE_FACTORY,
            USER_REGISTRY_IMPL
        );
        console2.log("1. SaplingFactory deployed:    ", address(factory));

        // 2. Deploy the user's UserRegistry through the factory.
        address userRegistry = factory.deployRegistry(admin);
        console2.log("2. UserRegistry proxy deployed:", userRegistry);

        // 3. Deploy a per-domain OpenRegistrar bound to the new registry.
        OpenRegistrar openRegistrar = new OpenRegistrar(
            IPermissionedRegistry(userRegistry)
        );
        console2.log("3. OpenRegistrar deployed:     ", address(openRegistrar));

        // 4. Grant the registrar role on the UserRegistry to OpenRegistrar.
        UserRegistry(userRegistry).grantRootRoles(
            RegistryRolesLib.ROLE_REGISTRAR,
            address(openRegistrar)
        );
        console2.log("4. Granted ROLE_REGISTRAR to OpenRegistrar");

        // 5. Wire the subregistry pointer on leooo.eth's token in the .eth registry.
        PermissionedRegistry(ETH_REGISTRY).setSubregistry(
            parentTokenId,
            IRegistry(userRegistry)
        );
        console2.log("5. .eth root now points 'leooo' at:", userRegistry);

        // 6. Mint a fresh test subname through the open registrar.
        uint256 leafTokenId = openRegistrar.register(TEST_SUBNAME, admin);
        console2.log(
            "6. Minted",
            string.concat(TEST_SUBNAME, ".", PARENT_LABEL, ".eth")
        );
        console2.log("   tokenId:", leafTokenId);

        vm.stopBroadcast();

        console2.log("");
        console2.log("== summary ==");
        console2.log("saplingFactory:", address(factory));
        console2.log("userRegistry: ", userRegistry);
        console2.log("openRegistrar:", address(openRegistrar));
        console2.log("test subname tokenId:", leafTokenId);
    }
}
