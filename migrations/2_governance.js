const RariToken = artifacts.require("RariToken.sol");
const WrappedRariToken = artifacts.require("WrappedRariToken.sol");
const TimelockController = artifacts.require("TimelockController")
const RariGovernor = artifacts.require("RariGovernor")

module.exports = async function (deployer, network) {
  
  //get rari token
  let rariAddress;
  if (network === "mainnet"){
    rariAddress = "0xFca59Cd816aB1eaD66534D82bc21E7515cE441CF"
    console.log(`using rari at ${rariAddress}`)
  } else {
    await deployer.deploy(RariToken, {gas:3000000})
    rariAddress = (await RariToken.deployed()).address;

    const rari = await RariToken.deployed();

    await rari.transferOwnership("0x3f46680099cF623163C96747a8ADdB85a1dA1Cd1")
    //отдать овнера
    console.log(`deployed rari at ${rariAddress}, owner = ${await rari.owner()}`)
  }

  //deploy wrapper for rari token
  await deployer.deploy(WrappedRariToken, rariAddress, {gas:2500000})
  const wrapper = await WrappedRariToken.deployed();
  console.log(`deployed rari wrapper at ${wrapper.address}`)

  //deploy timelock
  //todo: какой _minDelay? 30 минут
  //todo: proposers?
  //todo: executores?
  const _minDelay = 1800;
  await deployer.deploy(TimelockController, _minDelay, [], [], {gas:2000000})
  const timeLock = await TimelockController.deployed();
  console.log(`deployed timeLock at ${timeLock.address}`)

  //deploy governon
  await deployer.deploy(RariGovernor, wrapper.address, timeLock.address, {gas:4500000})
  const governor = await RariGovernor.deployed()
  console.log(`deployed governor at ${governor.address}`)

  //setting roles
  const PROPOSER_ROLE = await timeLock.PROPOSER_ROLE()
  const EXECUTOR_ROLE = await timeLock.EXECUTOR_ROLE();
  await timeLock.grantRole(PROPOSER_ROLE, governor.address, {gas: 60000})
  await timeLock.grantRole(EXECUTOR_ROLE, governor.address, {gas: 60000})
  
};
