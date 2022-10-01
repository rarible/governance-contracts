
const TestERC20 = artifacts.require("TestERC20.sol");
const RariGovernor = artifacts.require("RariGovernor")
const RariGovernorTest = artifacts.require("RariGovernorTest")

const RariTimelockController = artifacts.require("RariTimelockController")
const Staking = artifacts.require("Staking")

contract("Governance", accounts => {
  let erc20;
  let staking;
  let governorTest;
  let timelock;

  let epochSize;
  
	before(async () => {
    erc20 = await TestERC20.new();

    staking = await Staking.new()
    await staking.__Staking_init(erc20.address, 0)

    timelock = await RariTimelockController.new()
    await timelock.__RariTimelockController_init(0, [], [])
    
    governorTest = await RariGovernorTest.new()
    await governorTest.__RariGovernor_init(staking.address, timelock.address)

    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE()
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    await timelock.grantRole(PROPOSER_ROLE, governorTest.address)
    await timelock.grantRole(EXECUTOR_ROLE, governorTest.address)

    epochSize = await staking.WEEK()

    console.log("delyay", (await governorTest.votingDelay()).toString())
    console.log("block", (await governorTest.getBLock()).toString())
    console.log()

    await skipEpoch(epochSize)
	})

	describe("governance", () => {
    
    it ("delay", async () => {
      /*
      console.log("delyay", (await governorTest.votingDelay()).toString())
    console.log("block", (await governorTest.getBLock()).toString())
    console.log()


      await skipEpoch(epochSize)

      console.log("delyay", (await governorTest.votingDelay()).toString())
    console.log("block", (await governorTest.getBLock()).toString())
    console.log()
    */

      
    })
    
    
    it ("proposal", async () => {
      
      const voter1 = accounts[1]
      const voter2 = accounts[2]

      //minting and staking 1000 tokens voter1
      await erc20.mint(voter1, 1000);
   		await erc20.approve(staking.address, 1000, { from: voter1 });
			await staking.stake(voter1, voter1, 1000, 1000, 103, { from: voter1 }); //address account, address delegate, uint amount, uint slope, uint cliff

			assert.equal(await erc20.balanceOf(staking.address), 1000);				//balance Lock on deposite
  		assert.equal(await erc20.balanceOf(voter1), 0);			      //tail user balance
      assert.equal(await staking.balanceOf(voter1), 1000);  
      
      //minting 2000 and staking 1000 tokens voter2
      await erc20.mint(voter2, 2000);
   		await erc20.approve(staking.address, 1000, { from: voter2 });
			await staking.stake(voter2, voter2, 1000, 1000, 103, { from: voter2 }); //address account, address delegate, uint amount, uint slope, uint cliff

			assert.equal(await erc20.balanceOf(staking.address), 2000);				//balance Lock on deposite
  		assert.equal(await erc20.balanceOf(voter2), 1000);			      //tail user balance
      assert.equal(await staking.balanceOf(voter2), 1000);  

      //transfer tokens to timelock
      await erc20.transfer(timelock.address, 1000, {from: voter2})
      assert.equal(await erc20.balanceOf(voter2), 0);		
      assert.equal(await erc20.balanceOf(timelock.address), 1000);		

      //governance

      //console.log(await staking.getVotes(voter1))
      //console.log(await staking.getVotes(voter2))
      
      const user = accounts[9];
      const amount = 1000;

      const transferCalldata = await governorTest.encodeERC20Transfer(user, amount)

      //console.log(await governorTest.getBLock())
      const tx = await governorTest.propose(
        [erc20.address],
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

      await skipEpoch(50)

      //console.log(await governorTest.getBLock())
      
      await governorTest.castVote(proposalId, VoteType.For, {from: voter1})
      await governorTest.castVote(proposalId, VoteType.For, {from: voter2})
      
      console.log(await governorTest.proposals(proposalId))
      console.log(await governorTest.quorum(startBlock + 50)) 
      
      await moveToDeadLine(proposalId)

      assert.equal(await erc20.balanceOf(user), 0)

      const hashDiscr = await governorTest.hashDescription("Proposal #1: Give grant to team")

      await governorTest.queue(
        [erc20.address],
        [0],
        [transferCalldata],
        hashDiscr
      );

      //console.log(await timelock.getTimestamp(proposalId))
      await new Promise((resolve) => setTimeout(resolve, 1000 * 3))

      await governorTest.execute(
        [erc20.address],
        [0],
        [transferCalldata],
        hashDiscr
      );
      

      assert.equal(await erc20.balanceOf(user), 1000)
      
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

  async function skipEpoch(epochSize) {
    console.log("was block", (await governorTest.getBLock()).toString())
    for (let i = 0; i < epochSize; i ++){
      await governorTest.incrementBlock();
    }
    console.log("now block", (await governorTest.getBLock()).toString())
  }



})