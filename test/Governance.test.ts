import hre from "hardhat"
import { RariGovernorTest, RariTimelockController, TestERC20 } from "../typechain-types"
import { expect } from "chai"
import { EventLog } from "ethers"

describe("Governance", () => {
	let token: TestERC20
  let governorTest: RariGovernorTest
  let timelock: RariTimelockController

  let epochSize: bigint;

	before(async () => {
    const tokenFactory = await hre.ethers.getContractFactory("TestERC20")
    const timelockFactory = await hre.ethers.getContractFactory("RariTimelockController")
    const governorTestFactory = await hre.ethers.getContractFactory("RariGovernorTest")

    token = await tokenFactory.deploy();
    timelock = await timelockFactory.deploy()
    await timelock.__RariTimelockController_init(2, [], [])

    governorTest = await governorTestFactory.deploy()
    await governorTest.__RariGovernor_init(token, timelock)

    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE()
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    await timelock.grantRole(PROPOSER_ROLE, governorTest)
    await timelock.grantRole(EXECUTOR_ROLE, governorTest)

    epochSize = await token.WEEK()

    await skipEpoch()
	})

	describe("governance", () => {

    it("proposal works", async () => {
      const [owner, voter1, voter2, user] = await hre.ethers.getSigners()

      //minting 1000 tokens voter1
      await token.mint(voter1, 1000);
      await expect(token.balanceOf(voter1)).to.eventually.eq(1000)

      //minting 2000 tokens voter2
      await token.mint(voter2, 2000);
      await expect(token.balanceOf(voter2)).to.eventually.eq(2000)

      //transfer tokens to timelock
      await token.connect(voter2).transfer(timelock, 1000)
      await expect(token.balanceOf(voter2)).to.eventually.eq(1000)
      await expect(token.balanceOf(timelock)).to.eventually.eq(1000)

      //governance

      //console.log(await staking.getVotes(voter1))
      //console.log(await staking.getVotes(voter2))

      const amount = 1000;

      const transferCalldata = await governorTest.encodeERC20Transfer(user, amount)

      //console.log(await governorTest.getBLock())
      const tx = await governorTest["propose(address[],uint256[],bytes[],string)"](
        [token],
        [0],
        [transferCalldata],
        "Proposal #1: Give grant to team"
      );
      const receipt = await tx.wait()
      const logs = receipt?.logs
        .filter(it => "fragment" in it)
        .map(it => it as EventLog)
        .filter(it => it.fragment.name == "ProposalCreated") || []

      expect(logs).has.length(1)
      const proposalCreated = logs[0]
      const proposalId = proposalCreated.args[0]
      const proposal = await governorTest.proposals(proposalId)

      const VoteType = {
        Against: 0,
        For: 1,
        Abstain: 2
      }

      await moveToBLock(proposal.startBlock)

      //console.log(await governorTest.getBLock())

      await governorTest.connect(voter1).castVote(proposalId, VoteType.For)
      await governorTest.connect(voter2).castVote(proposalId, VoteType.For)

      await moveToBLock(proposal.endBlock)

      await expect(token.balanceOf(user)).to.eventually.eq(0)

      const hashDiscr = await governorTest.hashDescription("Proposal #1: Give grant to team")

      await governorTest["queue(address[],uint256[],bytes[],bytes32)"](
        [token],
        [0],
        [transferCalldata],
        hashDiscr
      );

      await expect(governorTest["execute(address[],uint256[],bytes[],bytes32)"]([token], [0], [transferCalldata], hashDiscr))
        .to.eventually.be.rejectedWith()

      //console.log(await timelock.getTimestamp(proposalId))
      await new Promise((resolve) => setTimeout(resolve, 1000 * 3))

      await governorTest["execute(address[],uint256[],bytes[],bytes32)"]([token], [0], [transferCalldata], hashDiscr)

      await expect(token.balanceOf(user)).to.eventually.eq(1000)
    })

	})

  async function moveToBLock(block: bigint) {
    let now = await governorTest.getBLock();
    console.log(`moving to block ${block}`)
    console.log("was:", now.toString())
    for (now; now <= Number(block); now ++){
      await governorTest.incrementBlock();
    }
    console.log("is:", (await governorTest.getBLock()).toString())
    console.log()
  }

  async function skipEpoch() {
    console.log("was block", (await governorTest.getBLock()).toString())
    for (let i = 0; i < epochSize; i ++){
      await governorTest.incrementBlock();
    }
    console.log("now block", (await governorTest.getBLock()).toString())
    console.log()
  }

})