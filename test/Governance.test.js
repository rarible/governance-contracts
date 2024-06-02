
const TestERC20 = artifacts.require("TestERC20.sol");
const RariGovernorTest = artifacts.require("RariGovernorTest")

const RariTimelockController = artifacts.require("RariTimelockController")

const UpgradeExecutor = artifacts.require("UpgradeExecutor")
const CancelProposalAction = artifacts.require("CancelProposalAction")
const ProxyUpgradeAction = artifacts.require("ProxyUpgradeAction")

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
  let updateExecutor;
  let updateExecutorImpl;

  let epochSize;

  let voter1;
  let voter2;
  let securityCouncil;
  
	before(async () => {
    securityCouncil = accounts[6];
  
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

    //deploy Executor
    updateExecutorImpl = await UpgradeExecutor.new()
    updateExecutor = await UpgradeExecutor.at((await TransparentUpgradeableProxy.new(updateExecutorImpl.address, proxyAdmin.address, "0x")).address)
    await updateExecutor.initialize(updateExecutor.address, [securityCouncil, timelock.address])

    const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
    await timelock.grantRole(CANCELLER_ROLE, updateExecutor.address)

    //transfering proxyAdmin's ownership to updateExecutor
    await proxyAdmin.transferOwnership(updateExecutor.address);

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

      const discr = "Proposal #1: Give grant to team";
      const tx = await governorTest.propose(
        [token.address],
        [0],
        [transferCalldata],
        discr
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

      const hashDiscr = await governorTest.hashDescription(discr)

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
      await governorTest.incrementBlock();

      await governorTest.execute(
        [token.address],
        [0],
        [transferCalldata],
        hashDiscr
      );
      
      assert.equal(await token.balanceOf(user), 1000)
    })

    it("proposal can be canceled by secuirty council", async () => {
      //governance
      const user = accounts[8];
      const amount = 1000;

      const transferCalldata = await governorTest.encodeERC20Transfer(user, amount)

      const discr = "Proposal #2: Give grant to team"

      const tx = await governorTest.propose(
        [token.address],
        [0],
        [transferCalldata],
        discr
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

      const hashDiscr = await governorTest.hashDescription(discr)

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
  
      const proposalIdTimelock = await timelock.hashOperationBatch(
        [token.address],
        [0],
        [transferCalldata],
        "0x00",
        hashDiscr
      )

      const cancelProposalAction = await CancelProposalAction.new(timelock.address);

      const cancelCallData = await governorTest.encodeCancelCall(proposalIdTimelock)
      
      await updateExecutor.execute(cancelProposalAction.address, cancelCallData, {from: securityCouncil})

    })

    it("proxy can be updated by secuirty council", async () => {
      const proxy = timelock.address;

      console.log(`was impl= ${await proxyAdmin.getProxyImplementation(proxy)}`);

      const proxyUpgradeAction = await ProxyUpgradeAction.new()

      const proxyUpgradeCalldata = await governorTest.encodeProxyUpgradeCall(proxyAdmin.address, proxy, token.address)

      await updateExecutor.execute(proxyUpgradeAction.address, proxyUpgradeCalldata, {from: securityCouncil})

      console.log(`then impl= ${await proxyAdmin.getProxyImplementation(proxy)}`);

      const proxyUpgradeCalldataBack = await governorTest.encodeProxyUpgradeCall(proxyAdmin.address, proxy, timelockImpl.address)
      await updateExecutor.execute(proxyUpgradeAction.address, proxyUpgradeCalldataBack, {from: securityCouncil})

      console.log(`and return back impl= ${await proxyAdmin.getProxyImplementation(proxy)}`);

    })

    it("proxy can be updated by proposals", async () => {
      const proxy = timelock.address;
      const newImpl = token.address;

      console.log(`was impl= ${await proxyAdmin.getProxyImplementation(proxy)}`);

      const proxyUpgradeAction = await ProxyUpgradeAction.new()

      const actionUpgradeCalldata = await governorTest.encodeProxyUpgradeCall(proxyAdmin.address, proxy, newImpl)

      const executorUpgradeCalldata = await governorTest.encodeUpgradeActionCall(proxyUpgradeAction.address, actionUpgradeCalldata);

      const discr = "Proposal #3: Give grant to team";

      const tx = await governorTest.propose(
        [updateExecutor.address],
        [0],
        [executorUpgradeCalldata],
        discr
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

      const hashDiscr = await governorTest.hashDescription(discr)

      await governorTest.queue(
        [updateExecutor.address],
        [0],
        [executorUpgradeCalldata],
        hashDiscr
      );

      await expectThrow(
        governorTest.execute(
          [updateExecutor.address],
          [0],
          [executorUpgradeCalldata],
          hashDiscr
        )
      )

      await new Promise((resolve) => setTimeout(resolve, 1000 * 3))
      await governorTest.incrementBlock();
      
      await governorTest.execute(
        [updateExecutor.address],
        [0],
        [executorUpgradeCalldata],
        hashDiscr
      )

      assert.equal(await proxyAdmin.getProxyImplementation(timelock.address), newImpl)
      console.log(`now impl= ${await proxyAdmin.getProxyImplementation(proxy)}`);
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