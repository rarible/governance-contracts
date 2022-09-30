const RariTimelockController = artifacts.require("RariTimelockController")
const RariGovernor = artifacts.require("RariGovernor")

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

//todo: set actual addresses
const mainnet = {
	staking: "0xFca59Cd816aB1eaD66534D82bc21E7515cE441CF",
  canceler: "0x3f46680099cF623163C96747a8ADdB85a1dA1Cd1"
}
const rinkeby = {
	staking: "0xfad6072626ec68003CEA5064AdA1b42A48352d9B",
  canceler: "0x3f46680099cF623163C96747a8ADdB85a1dA1Cd1"
}
const goerli = {
	staking: "0xD4B9A18296C952491E5D4BAa1AD95344B103c4b5",
  canceler: "0x19d2a55F2Bd362a9e09F674B722782329F63F3fB" //
}
const dev = {
	staking: "0x55eB2809896aB7414706AaCDde63e3BBb26e0BC6",
  canceler: "0x3f46680099cF623163C96747a8ADdB85a1dA1Cd1"
}
const def = {
	staking: "0x0000000000000000000000000000000000000000",
  canceler: "0x3f46680099cF623163C96747a8ADdB85a1dA1Cd1"
}

let settings = {
	"default": def,
	"rinkeby": rinkeby,
	"mainnet": mainnet,
	"goerli": goerli,
	"dev": dev
};

function getSettings(network) {
	if (settings[network] !== undefined) {
		return settings[network];
	} else {
		return settings["default"];
	}
}

module.exports = async function (deployer, network, accounts) {
  
  const {canceler, staking} = await getSettings(network);

  const admin = accounts[0]
  
  //deploy timelock
  const _minDelay = 50; //1800
  const timeLock = await deployProxy(RariTimelockController, [_minDelay, [], []], { deployer, initializer: '__RariTimelockController_init' })
  console.log(`deployed timeLock at ${timeLock.address}`)

  //deploy governon
  const governor = await deployProxy(RariGovernor, [staking, timeLock.address], { deployer, initializer: '__RariGovernor_init' })
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
