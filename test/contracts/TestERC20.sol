// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract TestERC20 is ERC20Upgradeable {
    function mint(address to, uint amount) external {
        _mint(to, amount);
    }

    function WEEK() external pure returns (uint) {
        return 50;
    }

    /**
     * @dev Returns the current amount of votes that `account` has.
     */
    function getVotes(address account) external view returns (uint256) {
        return balanceOf(account);
    }

    /**
     * @dev Returns the amount of votes that `account` had
     * at the end of the last period
     */
    function getPastVotes(address account, uint256 blockNumber) external view returns (uint256) {
        return balanceOf(account);
    }

    /**
     * @dev Returns the total supply of votes available 
     * at the end of the last period
     */
    function getPastTotalSupply(uint256 blockNumber) external view returns (uint256) {
        return totalSupply();
    }
}
