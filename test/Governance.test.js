
const RariToken = artifacts.require("RariToken.sol");
const RariGovernor = artifacts.require("RariGovernor")
const RariGovernorTest = artifacts.require("RariGovernorTest")

const TestHelper = artifacts.require("TestHelper")
const TimelockController = artifacts.require("TimelockController")
const Staking = artifacts.require("Staking")

contract("Governance", accounts => {
  let rari;
  let staking;
  let governor;
  let testHelper;
  let timelock;
  
	before(async () => {
    rari = await RariToken.new();

    staking = await Staking.new()
    await staking.__Staking_init(rari.address)

    timelock = await TimelockController.new(0, [], [])
    
    governor = await RariGovernorTest.new(staking.address, timelock.address)

    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE()
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    await timelock.grantRole(PROPOSER_ROLE, governor.address)
    await timelock.grantRole(EXECUTOR_ROLE, governor.address)
    
    testHelper = await TestHelper.new();
	})

	describe("governance", () => {
  
    it ("proposal", async () => {
      
      const voter1 = accounts[1]
      const voter2 = accounts[2]

      //minting and staking 1000 tokens voter1
      await rari.mint(voter1, 1000);
   		await rari.approve(staking.address, 1000, { from: voter1 });
			await staking.stake(voter1, voter1, 1000, 1000, 103, { from: voter1 }); //address account, address delegate, uint amount, uint slope, uint cliff

			assert.equal(await rari.balanceOf(staking.address), 1000);				//balance Lock on deposite
  		assert.equal(await rari.balanceOf(voter1), 0);			      //tail user balance
      assert.equal(await staking.balanceOf(voter1), 1000);  
      
      //minting 2000 and staking 1000 tokens voter2
      await rari.mint(voter2, 2000);
   		await rari.approve(staking.address, 1000, { from: voter2 });
			await staking.stake(voter2, voter2, 1000, 1000, 103, { from: voter2 }); //address account, address delegate, uint amount, uint slope, uint cliff

			assert.equal(await rari.balanceOf(staking.address), 2000);				//balance Lock on deposite
  		assert.equal(await rari.balanceOf(voter2), 1000);			      //tail user balance
      assert.equal(await staking.balanceOf(voter2), 1000);  

      //transfer tokens to timelock
      await rari.transfer(timelock.address, 1000, {from: voter2})
      assert.equal(await rari.balanceOf(voter2), 0);		
      assert.equal(await rari.balanceOf(timelock.address), 1000);		

      //governance

      console.log(await staking.getVotes(voter1))
      console.log(await staking.getVotes(voter2))
      
      const user = accounts[9];
      const amount = 1000;

      const transferCalldata = await testHelper.encodeERC20Transfer(user, amount)

      console.log(await testHelper.getBLock())
      const tx = await governor.propose(
        [rari.address],
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

      assert.equal(await rari.balanceOf(user), 0)

      const hashDiscr = await testHelper.hashDescription("Proposal #1: Give grant to team")

      await governor.queue(
        [rari.address],
        [0],
        [transferCalldata],
        hashDiscr
      );

      //console.log(await timelock.getTimestamp(proposalId))
      await new Promise((resolve) => setTimeout(resolve, 1000 * 3))

      await governor.execute(
        [rari.address],
        [0],
        [transferCalldata],
        hashDiscr
      );
      

      assert.equal(await rari.balanceOf(user), 1000)
      
    })
    
	})

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