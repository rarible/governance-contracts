// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestHelper {
    function encodeERC20Transfer(address to, uint amount) external pure returns(bytes memory){
        return abi.encodeWithSelector(ERC20.transfer.selector, to, amount);
    }

    function getBLock() external view returns(uint) {
        return block.number;
    }

    function incrementBlock() external {

    }

    function hashDescription(string calldata description) external pure returns(bytes32) {
        return keccak256(bytes(description));
    }
}