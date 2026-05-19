// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IHCAFactoryBasic} from "@ensv2/hca/interfaces/IHCAFactoryBasic.sol";

contract MockHCAFactoryBasic is IHCAFactoryBasic {
    mapping(address => address) internal _ownerOf;

    function setAccountOwner(address hca, address owner) external {
        _ownerOf[hca] = owner;
    }

    function getAccountOwner(address hca) external view returns (address) {
        return _ownerOf[hca];
    }
}
