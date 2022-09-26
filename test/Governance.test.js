
const RariToken = artifacts.require("RariToken.sol");
const WrappedRariToken = artifacts.require("WrappedRariToken.sol");
const RariGovernor = artifacts.require("RariGovernor")
const TestHelper = artifacts.require("TestHelper")
const TimelockController = artifacts.require("TimelockController")

contract("Governance", accounts => {
  let rari;
  let wrapperRari;
  let governor;
  let testHelper;
  let timelock;
  
	before(async () => {
    rari = await RariToken.deployed();
    wrapperRari = await WrappedRariToken.deployed()
    governor = await RariGovernor.deployed()
    timelock = await TimelockController.deployed()

    testHelper = await TestHelper.new();
	})

	describe("governance", () => {
  
    it ("proposal", async () => {
      const voter1 = accounts[1]
      const voter2 = accounts[2]
      
      await mintWrappedRari(voter1, 1000)
      await mintWrappedRari(voter2, 2000)

      await wrapperRari.delegate(voter1, {from: voter1})
      await wrapperRari.delegate(voter2, {from: voter2})

      await wrapperRari.transfer(timelock.address, 1000, {from: voter2})

      const user = accounts[9];
      const amount = 1000;

      const transferCalldata = await testHelper.encodeERC20Transfer(user, amount)

      console.log(await testHelper.getBLock())
      const tx = await governor.propose(
        [wrapperRari.address],
        [0],
        [transferCalldata],
        "Proposal #1: Give grant to team"
      );
      const startBlock = tx.receipt.blockNumber;

      const ProposalCreated = await governor.getPastEvents("ProposalCreated", {
        fromBlock: tx.receipt.blockNumber,
        toBlock: tx.receipt.blockNumber
      });

      const proposalId = (ProposalCreated[0].returnValues.proposalId)

      const VoteType = {
        Against: 0,
        For: 1,
        Abstain: 2
      }

      await testHelper.incrementBlock()
      
      await governor.castVote(proposalId, VoteType.For, {from: voter1})
      await governor.castVote(proposalId, VoteType.For, {from: voter2})
      
      console.log(await governor.proposals(proposalId))
      console.log(await governor.quorum(startBlock)) 
      
      await moveToDeadLine(proposalId)

      assert.equal(await wrapperRari.balanceOf(user), 0)

      const hashDiscr = await testHelper.hashDescription("Proposal #1: Give grant to team")

      await governor.queue(
        [wrapperRari.address],
        [0],
        [transferCalldata],
        hashDiscr
      );

      //console.log(await timelock.getTimestamp(proposalId))
      await new Promise((resolve) => setTimeout(resolve, 1000 * 3))

      await governor.execute(
        [wrapperRari.address],
        [0],
        [transferCalldata],
        hashDiscr
      );
      

      assert.equal(await wrapperRari.balanceOf(user), 1000)
    })
    
	})

  async function mintWrappedRari(user, amount) {
    await rari.mint(user, amount);
    await rari.approve(wrapperRari.address, amount, {from: user})

    await wrapperRari.depositFor(user, amount, {from: user})
  }

  async function moveToDeadLine(proposalId) {
    let now = await testHelper.getBLock();
    const deadline = (await governor.proposals(proposalId)).endBlock;
    console.log("was:", now)
    for (now; now <= deadline; now ++){
      await testHelper.incrementBlock();
    }
    console.log("is:", await testHelper.getBLock())
  }

})