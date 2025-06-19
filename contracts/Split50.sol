// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Split50 {
    address payable public immutable A;
    address payable public immutable B;

    error ZeroAddress();
    error ForwardFailed();

    constructor(address payable addrA, address payable addrB) payable {
        if (addrA == address(0) || addrB == address(0)) revert ZeroAddress();
        A = addrA;
        B = addrB;
    }

    receive() external payable {
        uint256 value = msg.value;
        uint256 half  = value / 2;

        (bool okA,) = A.call{value: half}("");
        if (!okA) revert ForwardFailed();

        (bool okB,) = B.call{value: value - half}("");
        if (!okB) revert ForwardFailed();
    }
}