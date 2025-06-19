import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	console.log(`deploying contracts on network ${hre.network.name}`)
	const { deploy } = hre.deployments;
	const { deployer } = await hre.getNamedAccounts();

	console.log("deploying contracts with the account:", deployer);

	await deploy("Split50", {
		from: deployer,
		autoMine: true,
		args: ["0x05A9D8e65032bFdff1730b5A4a817A8b7A7A5A8c", "0x90BeDbEf93120bf7E4AcDdd6171053c3A12903F0"],
		log: true
	})
}

export default func
func.tags = ['deploy-split-50']
