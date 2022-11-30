

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../contracts/RariGovernor.sol";
import "../../contracts/ProxyAdmin.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RariGovernorTest is RariGovernor {

    function votingPeriod() public pure override returns (uint256) {
        return 10; // 276 = 1 час, 46027 = 1 week 
    }

    function proposalThreshold() public pure override returns (uint256) {
        return 0;
    }

    function encodeERC20Transfer(address to, uint amount) external pure returns(bytes memory){
        return abi.encodeWithSelector(ERC20.transfer.selector, to, amount);
    }

    function getBlock() external view returns(uint) {
        return block.number;
    }

    function incrementBlock() external {

    }

    function hashDescription(string calldata description) external pure returns(bytes32) {
        return keccak256(bytes(description));
    }

    function encodeGrantRole(bytes32 role, address addr) external pure returns(bytes memory) {
        return abi.encodeWithSelector(AccessControlUpgradeable.grantRole.selector, role, addr);
    }

    function encodeUpgrade(address proxy, address impl) external pure returns(bytes memory) {
        return abi.encodeWithSelector(ProxyAdmin.upgrade.selector, TransparentUpgradeableProxy(payable(proxy)), impl);
    }

    function upgradeProxy(address adminProxy, address payable proxy, address newImpl) external {
        ProxyAdmin(adminProxy).upgrade(TransparentUpgradeableProxy(payable(proxy)), newImpl);
    }

}