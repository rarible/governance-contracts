

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../contracts/RariGovernor.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RariGovernorTest is RariGovernor {

    function votingDelay() public pure override returns (uint256) {
        return 0; // 46 = 10 минут, 6575 = 1 day 
    }

    function votingPeriod() public pure override returns (uint256) {
        return 10; // 276 = 1 час, 46027 = 1 week 
    }

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