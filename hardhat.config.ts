import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "hardhat-deploy"

const config: HardhatUserConfig = {
	solidity: {
		version: "0.8.24",
		settings: {
			optimizer: {
				enabled: true,
				runs: 200
			}
		}
	},
	networks: {
		hardhat: {
			allowBlocksWithSameTimestamp: true,
		},
		rari: {
			url: "http://127.0.0.1:1248",
			chainId: 1380012617,
			timeout: 60000,
		},
		arbitrum: {
			url: "http://127.0.0.1:1248",
			chainId: 42161,
			timeout: 60000,
		}
	},
	namedAccounts: {
		deployer: 0,
	},
}

// noinspection JSUnusedGlobalSymbols
export default config
