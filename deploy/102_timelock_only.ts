import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { RariTimelockController, RariTimelockController__factory } from "../typechain-types"

type ChainConfig = {
	admin: `0x${string}`,
}

const configs: Record<string, ChainConfig> = {
	arbitrum: {
		admin: "0x8ac412F1eB56B01ba910C71f4Fad1c7f70Efb4E5"
	}
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	console.log(`deploying contracts on network ${hre.network.name}`)
	const config = getConfig(hre.network.name)

	const { deploy } = hre.deployments;
	const { deployer } = await hre.getNamedAccounts();

	console.log("deploying contracts with the account:", deployer);

	const _minDelay = 172_800; //172800 = 2 дня
	const timeLock = await deploy("RariTimelockController", {
		from: deployer,
		proxy: {
			execute: {
				init: {
					methodName: "__RariTimelockController_init",
					args: [_minDelay, [], []],
				},
			},
		},
		autoMine: true,
		log: true,
	})
	console.log("deployed timelock at " + timeLock.address)

	const factory = await hre.ethers.getContractFactory("RariTimelockController")
	const timeLockAttached = factory.attach(timeLock.address) as RariTimelockController

	//setting roles
	const PROPOSER_ROLE = await timeLockAttached.PROPOSER_ROLE()
	const EXECUTOR_ROLE = await timeLockAttached.EXECUTOR_ROLE();
	const CANCELLER_ROLE = await timeLockAttached.CANCELLER_ROLE();
	const TIMELOCK_ADMIN_ROLE = await timeLockAttached.TIMELOCK_ADMIN_ROLE();

	//governon contract is proposer and executor
	await timeLockAttached.grantRole(PROPOSER_ROLE, config.admin)
	await timeLockAttached.grantRole(EXECUTOR_ROLE, config.admin)

	// setting canceller
	await timeLockAttached.grantRole(CANCELLER_ROLE, deployer)
}

function getConfig(chain: string): ChainConfig {
	const config = configs[chain]
	if (config === undefined) {
		throw new Error(`Unknown chain: ${chain}`)
	}
	return config
}

export default func
func.tags = ['deploy-timelock-only']
