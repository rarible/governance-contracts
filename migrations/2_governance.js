const RariToken = artifacts.require("RariToken.sol");
const Staking = artifacts.require("Staking");

const TimelockController = artifacts.require("TimelockController")
const RariGovernor = artifacts.require("RariGovernor")

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {

  const admin = accounts[0]
  const canceler = "0x3f46680099cF623163C96747a8ADdB85a1dA1Cd1"

  const rari = await RariToken.deployed().catch(() => deployer.deploy(RariToken, { gas: 3000000 }));

  //const staking = await deployProxy(Staking, [rari.address], { deployer, initializer: '__Staking_init' })
  await deployer.deploy(Staking, rari.address, {gas:4000000})
  const staking = await Staking.deployed()
  console.log(`deployed staking at ${staking.address}`)
  
  //deploy timelock
  const _minDelay = 1800;
  await deployer.deploy(TimelockController, _minDelay, [], [], {gas:2000000})
  const timeLock = await TimelockController.deployed();
  console.log(`deployed timeLock at ${timeLock.address}`)

  //deploy governon
  await deployer.deploy(RariGovernor, staking.address, timeLock.address, {gas:4500000})
  const governor = await RariGovernor.deployed()
  console.log(`deployed governor at ${governor.address}`)

  //setting roles
  const PROPOSER_ROLE = await timeLock.PROPOSER_ROLE()
  const EXECUTOR_ROLE = await timeLock.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await timeLock.CANCELLER_ROLE();
  const TIMELOCK_ADMIN_ROLE = await timeLock.TIMELOCK_ADMIN_ROLE();

  //governon contract is proposer and executor
  await timeLock.grantRole(PROPOSER_ROLE, governor.address, {gas: 60000})
  await timeLock.grantRole(EXECUTOR_ROLE, governor.address, {gas: 60000})

  // setting canceller
  await timeLock.grantRole(CANCELLER_ROLE, canceler, {gas: 60000})
  //todo: delete
  await timeLock.grantRole(TIMELOCK_ADMIN_ROLE, canceler, {gas: 60000})
  
  //todo: uncomment
  //renounce admin role from deployer
  //await timeLock.renounceRole(TIMELOCK_ADMIN_ROLE, admin, {gas: 60000})

};
