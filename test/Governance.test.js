
const TestERC20 = artifacts.require("TestERC20.sol");
const RariGovernorTest = artifacts.require("RariGovernorTest")

const RariTimelockController = artifacts.require("RariTimelockController")

const ProxyAdmin = artifacts.require("ProxyAdmin")
const TransparentUpgradeableProxy = artifacts.require("TransparentUpgradeableProxy")

const { expectThrow } = require("@daonomic/tests-common");

contract("Governance", accounts => {
  let token;
  let governorTest;
  let timelock;
  let proxyAdmin;
  let timelockImpl;
  let governorImpl;

  let epochSize;

  let voter1;
  let voter2;
  
	before(async () => {
    proxyAdmin = await ProxyAdmin.new();
    token = await TestERC20.new();

    timelockImpl = await RariTimelockController.new()
    
    timelock = await RariTimelockController.at((await TransparentUpgradeableProxy.new(timelockImpl.address, proxyAdmin.address, "0x")).address)
    await timelock.__RariTimelockController_init(2, [], [])
    
    governorImpl = await RariGovernorTest.new()

    governorTest = await RariGovernorTest.at((await TransparentUpgradeableProxy.new(governorImpl.address, proxyAdmin.address, "0x")).address)
    await governorTest.__RariGovernor_init(token.address, timelock.address)

    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE()
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    await timelock.grantRole(PROPOSER_ROLE, governorTest.address)
    await timelock.grantRole(EXECUTOR_ROLE, governorTest.address)

    epochSize = Number(await token.WEEK())

    await skipEpoch()

    voter1 = accounts[1]
    voter2 = accounts[2]

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
	})

	describe("governance", () => {    
    
    it("proposal works", async () => {
      //governance
      const user = accounts[9];
      const amount = 1000;

      const transferCalldata = await governorTest.encodeERC20Transfer(user, amount)

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

      await new Promise((resolve) => setTimeout(resolve, 1000 * 3))

      await governorTest.execute(
        [token.address],
        [0],
        [transferCalldata],
        hashDiscr
      );
      
      assert.equal(await token.balanceOf(user), 1000)
    })

    it("timelock can grant roles", async () => {
      const admin = accounts[0]

      const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();

      //renouncing adming role
      assert.equal(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, admin), true)
      await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, admin)
      assert.equal(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, admin), false)
      
      //can't grant roles anymore
      await expectThrow(
        timelock.grantRole(TIMELOCK_ADMIN_ROLE, admin)
      );

      //grant role with proposal
      //governance
      const user = accounts[9];
      assert.equal(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, user), false)

      const grantRoleCalldata = await governorTest.encodeGrantRole(TIMELOCK_ADMIN_ROLE, user)
      
      const tx = await governorTest.propose(
        [timelock.address],
        [0],
        [grantRoleCalldata],
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
      
      await governorTest.castVote(proposalId, VoteType.For, {from: voter1})
      await governorTest.castVote(proposalId, VoteType.For, {from: voter2})
      
      await moveToBLock(proposal.endBlock)

      const hashDiscr = await governorTest.hashDescription("Proposal #1: Give grant to team")

      await governorTest.queue(
        [timelock.address],
        [0],
        [grantRoleCalldata],
        hashDiscr
      );

      await new Promise((resolve) => setTimeout(resolve, 1000 * 3))

      await governorTest.execute(
        [timelock.address],
        [0],
        [grantRoleCalldata],
        hashDiscr
      );

      assert.equal(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, user), true)
    })

    it("contracts can be upgraded by proposals", async () => {

      const newImpl = token.address;

      const upgradeCalldata = await governorTest.encodeUpgrade(governorTest.address, newImpl);

      const tx = await governorTest.propose(
        [proxyAdmin.address],
        [0],
        [upgradeCalldata],
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
      
      await governorTest.castVote(proposalId, VoteType.For, {from: voter1})
      await governorTest.castVote(proposalId, VoteType.For, {from: voter2})
      
      await moveToBLock(proposal.endBlock)

      const hashDiscr = await governorTest.hashDescription("Proposal #1: Give grant to team")

      await governorTest.queue(
        [proxyAdmin.address],
        [0],
        [upgradeCalldata],
        hashDiscr
      );

      await new Promise((resolve) => setTimeout(resolve, 1000 * 3))

      await expectThrow(
        governorTest.execute(
          [proxyAdmin.address],
          [0],
          [upgradeCalldata],
          hashDiscr
        )
      )

      //setting governer as owner of the ProxyAdmin contract 
      const oldAdmin = await proxyAdmin.owner();
      assert.equal(oldAdmin, accounts[0])

      await proxyAdmin.transferOwnership(timelock.address)
      assert.equal(await proxyAdmin.owner(), timelock.address)
      
      await governorTest.execute(
        [proxyAdmin.address],
        [0],
        [upgradeCalldata],
        hashDiscr
      )

      assert.equal(await proxyAdmin.getProxyImplementation(governorTest.address), newImpl)
    })
    
	})

  async function moveToBLock(block) {
    let now = await governorTest.getBlock();
    console.log(`moving to block ${block} from ${block - epochSize}`)
    for (now; now <= Number(block); now ++){
      await governorTest.incrementBlock();
    }
  }

  async function skipEpoch() {
    await moveToBLock(Number(await governorTest.getBlock()) + epochSize)
  }
})