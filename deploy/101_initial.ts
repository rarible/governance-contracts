import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { RariTimelockController, RariTimelockController__factory } from "../typechain-types"

type ChainConfig = {
	token: `0x${string}`
}

const configs: Record<string, ChainConfig> = {
	rari: {
		token: "0xCf78572A8fE97b2B9a4B9709f6a7D9a863c1b8E0"
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
			proxyContract: "EIP173ProxyWithReceive",
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

	const governor = await deploy("RariGovernor", {
		from: deployer,
		proxy: {
			proxyContract: "EIP173ProxyWithReceive",
			execute: {
				init: {
					methodName: "__RariGovernor_init",
					args: [config.token, timeLock.address]
				}
			}
		}
	})
	console.log("deployed governor at " + governor.address)

	const factory = await hre.ethers.getContractFactory("RariTimelockController")
	const timeLockAttached = factory.attach(timeLock.address) as RariTimelockController

	//setting roles
	const PROPOSER_ROLE = await timeLockAttached.PROPOSER_ROLE()
	const EXECUTOR_ROLE = await timeLockAttached.EXECUTOR_ROLE();
	const CANCELLER_ROLE = await timeLockAttached.CANCELLER_ROLE();
	const TIMELOCK_ADMIN_ROLE = await timeLockAttached.TIMELOCK_ADMIN_ROLE();

	//governon contract is proposer and executor
	await timeLockAttached.grantRole(PROPOSER_ROLE, governor.address)
	await timeLockAttached.grantRole(EXECUTOR_ROLE, governor.address)

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
func.tags = ['deploy-timelock', 'deploy-governor', 'all']
