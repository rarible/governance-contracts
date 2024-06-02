// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.13;

import "../RariTimelockController.sol";

contract CancelProposalAction {
    RariTimelockController public immutable timelock;

    constructor(RariTimelockController _timelock) {
        timelock = _timelock;
    }

    function perform(bytes32 proposalID) external {
        timelock.cancel(proposalID);
    }
}
