

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../contracts/RariGovernor.sol";

contract RariGovernorTest is RariGovernor {
    constructor(IVotes _token, TimelockController _timelock) RariGovernor(_token, _timelock) {

    }

    function votingDelay() public pure override returns (uint256) {
        return 0; // 46 = 10 минут, 6575 = 1 day 
    }

    function votingPeriod() public pure override returns (uint256) {
        return 10; // 276 = 1 час, 46027 = 1 week 
    }
}