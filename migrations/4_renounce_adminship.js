const RariTimelockController = artifacts.require("RariTimelockController")
const RariGovernor = artifacts.require("RariGovernor")
const ProxyAdmin = artifacts.require("ProxyAdmin")

const mainnet = {
	adminProxyAddress: "0xDc8BaA86f136F8B0851F090a4DfFDc7b5F46688D",
}
const goerli = {
	adminProxyAddress: "0x919AEd466F30A821670b12aaab3A4102d8536486",
}
const def = {
	adminProxyAddress: "0x0000000000000000000000000000000000000000",
}

let settings = {
	"default": def,
	"mainnet": mainnet,
	"goerli": goerli
};

function getSettings(network) {
	if (settings[network] !== undefined) {
		return settings[network];
	} else {
		return settings["default"];
	}
}

module.exports = async function (deployer, network, accounts) {

  if (network === "test") {
    console.log("not executing 4th migratinon in tests")
    return;
  }

  const adminProxyAddress = getSettings(network)

  const admin = accounts[0]
  console.log(`deployer = ${admin}`)
  const timeLock = await RariTimelockController.deployed()
  console.log(`using timeLock at ${timeLock.address}`)

  //renouncing TIMELOCK_ADMIN_ROLE role  
  const TIMELOCK_ADMIN_ROLE = await timeLock.TIMELOCK_ADMIN_ROLE()
  await timeLock.renounceRole(TIMELOCK_ADMIN_ROLE, admin, {gas: 60000})

  //making timeLock admin of it's own (and governor's) ProxyAdmin contract
  const proxyAdmin = await ProxyAdmin.at(adminProxyAddress)

  const oldAdmin = await proxyAdmin.owner();
  await proxyAdmin.transferOwnership(timeLock.address)
  console.log(`changed governer prxoxyAdmin(${proxyAdmin.address}) owner from ${oldAdmin} to ${await proxyAdmin.owner()}`)

};
