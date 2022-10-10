const RariTimelockController = artifacts.require("RariTimelockController")
const RariGovernor = artifacts.require("RariGovernor")

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const mainnet = {
	staking: "0x096Bd9a7a2e703670088C05035e23c7a9F428496",
  canceler: "0x2A446ABAE8973A70225796AE7B461Afe77FdbED5"
}
const rinkeby = {
	staking: "0xAc8369a64e35d4778e535Ac78398f2Bb09bCa7f0",
  canceler: "0x3f46680099cF623163C96747a8ADdB85a1dA1Cd1"
}
const goerli = {
	staking: "0x6D5E228C25730502aF5ACffa2eB34956c33ad7C2",
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
  
  const { staking } = await getSettings(network);

  const admin = accounts[0]
  
  //deploy timelock
  const timeLock = await RariTimelockController.deployed()
  console.log(`using timeLock at ${timeLock.address}`)

  //deploy governon
  const governor = await deployProxy(RariGovernor, [staking, timeLock.address], { deployer, initializer: '__RariGovernor_init' })
  console.log(`deployed governor at ${governor.address} for ${staking}`)

  //setting roles
  const PROPOSER_ROLE = await timeLock.PROPOSER_ROLE()
  const EXECUTOR_ROLE = await timeLock.EXECUTOR_ROLE();

  //governon contract is proposer and executor
  await timeLock.grantRole(PROPOSER_ROLE, governor.address, {gas: 60000})
  await timeLock.grantRole(EXECUTOR_ROLE, governor.address, {gas: 60000})

};
