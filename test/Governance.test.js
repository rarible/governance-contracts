
const TestERC20 = artifacts.require("TestERC20.sol");
const RariGovernorTest = artifacts.require("RariGovernorTest")

const RariTimelockController = artifacts.require("RariTimelockController")

const { expectThrow } = require("@daonomic/tests-common");

contract("Governance", accounts => {
  let token;
  let governorTest;
  let timelock;

  let epochSize;
  
	before(async () => {
    token = await TestERC20.new();

    timelock = await RariTimelockController.new()
    await timelock.__RariTimelockController_init(2, [], [])
    
    governorTest = await RariGovernorTest.new()
    await governorTest.__RariGovernor_init(token.address, timelock.address)

    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE()
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    await timelock.grantRole(PROPOSER_ROLE, governorTest.address)
    await timelock.grantRole(EXECUTOR_ROLE, governorTest.address)

    epochSize = await token.WEEK()

    await skipEpoch()
	})

	describe("governance", () => {    
    
    it("proposal works", async () => {
      
      const voter1 = accounts[1]
      const voter2 = accounts[2]

      //minting 1000 tokens voter1
      await token.mint(voter1, 1000);
			assert.equal(await token.balanceOf(voter1), 1000);
      
      //minting 2000 tokens voter2
      await token.mint(voter2, 2000);
			assert.equal(await token.balanceOf(voter2), 2000);

      //transfer tokens to timelock
      await token.transfer(timelock.address, 1000, {from: voter2})
      assert.equal(await token.balanceOf(voter2), 1000);		
      assert.equal(await token.balanceOf(timelock.address), 1000);		

      //governance

      //console.log(await staking.getVotes(voter1))
      //console.log(await staking.getVotes(voter2))
      
      const user = accounts[9];
      const amount = 1000;

      const transferCalldata = await governorTest.encodeERC20Transfer(user, amount)

      //console.log(await governorTest.getBLock())
      const tx = await governorTest.propose(
        [token.address],
        [0],
        [transferCalldata],
        "Proposal #1: Give grant to team"
      );

      const ProposalCreated = await governorTest.getPastEvents("ProposalCreated", {
        fromBlock: tx.receipt.blockNumber,
        toBlock: tx.receipt.blockNumber
      });

      const proposalId = (ProposalCreated[0].returnValues.proposalId)
      const proposal = await governorTest.proposals(proposalId)

      const VoteType = {
        Against: 0,
        For: 1,
        Abstain: 2
      }

      await moveToBLock(proposal.startBlock)

      //console.log(await governorTest.getBLock())
      
      await governorTest.castVote(proposalId, VoteType.For, {from: voter1})
      await governorTest.castVote(proposalId, VoteType.For, {from: voter2})
      
      await moveToBLock(proposal.endBlock)

      assert.equal(await token.balanceOf(user), 0)

      const hashDiscr = await governorTest.hashDescription("Proposal #1: Give grant to team")

      await governorTest.queue(
        [token.address],
        [0],
        [transferCalldata],
        hashDiscr
      );

      await expectThrow(
        governorTest.execute(
          [token.address],
          [0],
          [transferCalldata],
          hashDiscr
        )
      );

      //console.log(await timelock.getTimestamp(proposalId))
      await new Promise((resolve) => setTimeout(resolve, 1000 * 3))

      await governorTest.execute(
        [token.address],
        [0],
        [transferCalldata],
        hashDiscr
      );
      

      assert.equal(await token.balanceOf(user), 1000)
      
    })

    it("cancel + quorum", async () => {
    
    })
    
	})

  async function moveToBLock(block) {
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