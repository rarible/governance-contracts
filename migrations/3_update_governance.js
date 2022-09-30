const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const RariGovernor = artifacts.require("RariGovernor");

module.exports = async function (deployer, network) {
  /*
  const existing = await RariGovernor.deployed();
  await upgradeProxy(existing.address, RariGovernor, { deployer });
  */
};
