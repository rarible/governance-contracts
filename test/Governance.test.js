
const RariToken = artifacts.require("RariToken.sol");
const RariGovernor = artifacts.require("RariGovernor")
const RariGovernorTest = artifacts.require("RariGovernorTest")

const TimelockController = artifacts.require("TimelockController")
const Staking = artifacts.require("Staking")

contract("Governance", accounts => {
  let rari;
  let staking;
  let governorTest;
  let timelock;
  
	before(async () => {
    rari = await RariToken.new();

    staking = await Staking.new()
    await staking.__Staking_init(rari.address, 0)

    timelock = await TimelockController.new(0, [], [])
    
    governorTest = await RariGovernorTest.new()
    await governorTest.__RariGovernor_init(staking.address, timelock.address)

    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE()
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    await timelock.grantRole(PROPOSER_ROLE, governorTest.address)
    await timelock.grantRole(EXECUTOR_ROLE, governorTest.address)
    
    console.log(await governorTest.getBLock())
    for (let i = 0; i <= 50; i ++){
      await governorTest.incrementBlock();
    }
    console.log(await governorTest.getBLock())
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

      const transferCalldata = await governorTest.encodeERC20Transfer(user, amount)

      console.log(await governorTest.getBLock())
      const tx = await governorTest.propose(
        [rari.address],
        [0],
        [transferCalldata],
        "Proposal #1: Give grant to team"
      );
      const startBlock = tx.receipt.blockNumber;

      const ProposalCreated = await governorTest.getPastEvents("ProposalCreated", {
        fromBlock: tx.receipt.blockNumber,
        toBlock: tx.receipt.blockNumber
      });

      const proposalId = (ProposalCreated[0].returnValues.proposalId)

      const VoteType = {
        Against: 0,
        For: 1,
        Abstain: 2
      }

      await governorTest.incrementBlock()
      
      await governorTest.castVote(proposalId, VoteType.For, {from: voter1})
      await governorTest.castVote(proposalId, VoteType.For, {from: voter2})
      
      console.log(await governorTest.proposals(proposalId))
      console.log(await governorTest.quorum(startBlock)) 
      
      await moveToDeadLine(proposalId)

      assert.equal(await rari.balanceOf(user), 0)

      const hashDiscr = await governorTest.hashDescription("Proposal #1: Give grant to team")

      await governorTest.queue(
        [rari.address],
        [0],
        [transferCalldata],
        hashDiscr
      );

      //console.log(await timelock.getTimestamp(proposalId))
      await new Promise((resolve) => setTimeout(resolve, 1000 * 3))

      await governorTest.execute(
        [rari.address],
        [0],
        [transferCalldata],
        hashDiscr
      );
      

      assert.equal(await rari.balanceOf(user), 1000)
      
    })
    
	})

  async function moveToDeadLine(proposalId) {
    let now = await governorTest.getBLock();
    const deadline = (await governorTest.proposals(proposalId)).endBlock;
    console.log("was:", now)
    for (now; now <= deadline; now ++){
      await governorTest.incrementBlock();
    }
    console.log("is:", await governorTest.getBLock())
  }

})