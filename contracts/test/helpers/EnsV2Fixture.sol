// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

import {VerifiableFactory} from "@ensdomains/verifiable-factory/VerifiableFactory.sol";

import {BaseUriRegistryMetadata} from "@ensv2/registry/BaseUriRegistryMetadata.sol";
import {PermissionedRegistry} from "@ensv2/registry/PermissionedRegistry.sol";
import {UserRegistry} from "@ensv2/registry/UserRegistry.sol";
import {PermissionedResolver} from "@ensv2/resolver/PermissionedResolver.sol";
import {EACBaseRolesLib} from "@ensv2/access-control/libraries/EACBaseRolesLib.sol";

import {MockHCAFactoryBasic} from "./MockHCAFactoryBasic.sol";

/// @dev Minimal ENSv2 environment for forge tests: root registry, `.eth`
///      registry under it, plus the impls we proxy at deploy time.
contract EnsV2Fixture is Test, ERC1155Holder {
    VerifiableFactory internal verifiableFactory;
    MockHCAFactoryBasic internal hcaFactory;
    BaseUriRegistryMetadata internal metadata;

    UserRegistry internal userRegistryImpl;
    PermissionedResolver internal resolverImpl;

    PermissionedRegistry internal rootRegistry;
    PermissionedRegistry internal ethRegistry;

    function deployEnsV2Fixture() internal {
        verifiableFactory = new VerifiableFactory();
        hcaFactory = new MockHCAFactoryBasic();
        metadata = new BaseUriRegistryMetadata(hcaFactory);

        userRegistryImpl = new UserRegistry(hcaFactory, metadata);
        resolverImpl = new PermissionedResolver(hcaFactory);

        rootRegistry = new PermissionedRegistry(
            hcaFactory,
            metadata,
            address(this),
            EACBaseRolesLib.ALL_ROLES
        );
        ethRegistry = new PermissionedRegistry(
            hcaFactory,
            metadata,
            address(this),
            EACBaseRolesLib.ALL_ROLES
        );

        rootRegistry.register(
            "eth",
            address(this),
            ethRegistry,
            address(0),
            EACBaseRolesLib.ALL_ROLES,
            type(uint64).max
        );
    }

    function deployUserRegistry(
        address admin,
        uint256 salt
    ) internal returns (UserRegistry) {
        return
            UserRegistry(
                verifiableFactory.deployProxy(
                    address(userRegistryImpl),
                    salt,
                    abi.encodeCall(
                        UserRegistry.initialize,
                        (admin, EACBaseRolesLib.ALL_ROLES)
                    )
                )
            );
    }

    function deployResolver(
        address admin,
        uint256 salt
    ) internal returns (PermissionedResolver) {
        return
            PermissionedResolver(
                verifiableFactory.deployProxy(
                    address(resolverImpl),
                    salt,
                    abi.encodeCall(
                        PermissionedResolver.initialize,
                        (admin, EACBaseRolesLib.ALL_ROLES)
                    )
                )
            );
    }

    function registerEthChild(
        string memory label,
        address owner,
        PermissionedRegistry subregistry
    ) internal returns (uint256 tokenId) {
        tokenId = ethRegistry.register(
            label,
            owner,
            subregistry,
            address(0),
            EACBaseRolesLib.ALL_ROLES,
            type(uint64).max
        );
    }
}
