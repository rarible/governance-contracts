const RariTimelockController = artifacts.require("RariTimelockController")

module.exports = async function (deployer, network, accounts) {

  const securityCouncilAddress = "0xd35ec9F67Aa082Ae666be1716C79291f1f6e4E0a"

  const timeLock = await RariTimelockController.deployed();

  const CANCELLER_ROLE = await timeLock.CANCELLER_ROLE();

  console.log(`giving ${securityCouncilAddress} address canceler role (${CANCELLER_ROLE}) in timelock contract ${timeLock.address}`)

  // setting canceller
  await timeLock.grantRole(CANCELLER_ROLE, securityCouncilAddress, {gas: 60000})
  
  console.log(`role was set: ${await timeLock.hasRole(CANCELLER_ROLE, securityCouncilAddress)}`)
};
