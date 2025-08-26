const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeLangZetaUniversal - Reward Distribution Tests", function () {
  let contract;
  let owner;
  let serverAddress;
  let user1;
  let user2;
  let user3;
  let systemContract;
  let taskId;

  beforeEach(async function () {
    [owner, serverAddress, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock system contract
    const MockSystemContract = await ethers.getContractFactory("MockSystemContract");
    systemContract = await MockSystemContract.deploy();
    await systemContract.waitForDeployment();

    // Deploy main contract
    const DeLangZetaUniversal = await ethers.getContractFactory("DeLangZetaUniversal");
    contract = await DeLangZetaUniversal.deploy(
      await systemContract.getAddress(),
      serverAddress.address
    );
    await contract.waitForDeployment();

    // Create a task for testing
    const taskSpec = {
      title: "Reward Test Task",
      description: "Test reward distribution",
      language: "en",
      dataType: "text",
      criteria: "Test criteria",
      rewardPerSubmission: ethers.parseEther("0.1"),
      totalReward: ethers.parseEther("1"),
      deadline: Math.floor(Date.now() / 1000) + 86400,
      maxSubmissions: 10,
      requiresValidation: true
    };

    await contract.connect(user1).createTaskOmnichain(
      taskSpec,
      1337,
      ethers.ZeroAddress,
      ethers.parseEther("1"),
      { value: ethers.parseEther("1") }
    );
    taskId = "task_1";
  });

  describe("Reward Calculation", function () {
    it("Should calculate reward details correctly", async function () {
      const rewardCalc = await contract.getRewardCalculation(taskId);

      expect(rewardCalc.totalFunded).to.equal(ethers.parseEther("1"));
      expect(rewardCalc.remainingReward).to.equal(ethers.parseEther("1"));
      expect(rewardCalc.distributedReward).to.equal(0);
      expect(rewardCalc.maxPossibleReward).to.equal(ethers.parseEther("1")); // 0.1 * 10
    });

    it("Should track distributed rewards correctly", async function () {
      // Simulate reward distribution by calling claimRewardsOmnichainSecure
      const claimAmount = ethers.parseEther("0.1");

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "uint256", "uint256", "address", "uint256"],
        [user2.address, taskId, claimAmount, 1337, user2.address, 1234567890]
      );
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      // Mock the timestamp validation by using a fixed timestamp
      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      await contract.connect(user2).claimRewardsOmnichainSecure(
        taskId,
        claimAmount,
        1337,
        user2.address,
        serverSignature
      );

      const rewardCalc = await contract.getRewardCalculation(taskId);
      expect(rewardCalc.remainingReward).to.equal(ethers.parseEther("0.9"));
      expect(rewardCalc.distributedReward).to.equal(ethers.parseEther("0.1"));
    });
  });

  describe("Batch Reward Distribution", function () {
    it("Should distribute rewards to multiple recipients", async function () {
      const recipients = [user2.address, user3.address];
      const amounts = [ethers.parseEther("0.1"), ethers.parseEther("0.2")];
      const targetChains = [1337, 1337]; // Same chain for testing

      const messageHash = ethers.solidityPackedKeccak256(
        ["string", "address[]", "uint256[]", "uint256[]", "uint256"],
        [taskId, recipients, amounts, targetChains, 1234567890]
      );
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      const initialBalance2 = await ethers.provider.getBalance(user2.address);
      const initialBalance3 = await ethers.provider.getBalance(user3.address);

      const tx = await contract.connect(serverAddress).distributeRewardsOmnichain(
        taskId,
        recipients,
        amounts,
        targetChains,
        serverSignature
      );

      // Check events
      await expect(tx)
        .to.emit(contract, "RewardDistributedOmnichain")
        .withArgs(user2.address, amounts[0], ethers.ZeroAddress, 1337, 1337);

      await expect(tx)
        .to.emit(contract, "RewardDistributedOmnichain")
        .withArgs(user3.address, amounts[1], ethers.ZeroAddress, 1337, 1337);

      // Check balances increased
      const finalBalance2 = await ethers.provider.getBalance(user2.address);
      const finalBalance3 = await ethers.provider.getBalance(user3.address);

      expect(finalBalance2).to.be.greaterThan(initialBalance2);
      expect(finalBalance3).to.be.greaterThan(initialBalance3);

      // Check remaining reward
      const rewardCalc = await contract.getRewardCalculation(taskId);
      expect(rewardCalc.remainingReward).to.equal(ethers.parseEther("0.7")); // 1 - 0.1 - 0.2
    });

    it("Should reject batch distribution with mismatched arrays", async function () {
      const recipients = [user2.address, user3.address];
      const amounts = [ethers.parseEther("0.1")]; // Mismatched length
      const targetChains = [1337, 1337];

      const messageHash = ethers.solidityPackedKeccak256(
        ["string", "address[]", "uint256[]", "uint256[]", "uint256"],
        [taskId, recipients, amounts, targetChains, 1234567890]
      );
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      await expect(
        contract.connect(serverAddress).distributeRewardsOmnichain(
          taskId,
          recipients,
          amounts,
          targetChains,
          serverSignature
        )
      ).to.be.revertedWith("Recipients and amounts length mismatch");
    });

    it("Should reject batch distribution with insufficient rewards", async function () {
      const recipients = [user2.address, user3.address];
      const amounts = [ethers.parseEther("0.6"), ethers.parseEther("0.6")]; // Total > remaining
      const targetChains = [1337, 1337];

      const messageHash = ethers.solidityPackedKeccak256(
        ["string", "address[]", "uint256[]", "uint256[]", "uint256"],
        [taskId, recipients, amounts, targetChains, 1234567890]
      );
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      await expect(
        contract.connect(serverAddress).distributeRewardsOmnichain(
          taskId,
          recipients,
          amounts,
          targetChains,
          serverSignature
        )
      ).to.be.revertedWith("Insufficient remaining reward");
    });
  });

  describe("Secure Reward Claims", function () {
    it("Should allow secure reward claims with valid signature", async function () {
      const claimAmount = ethers.parseEther("0.1");

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "uint256", "uint256", "address", "uint256"],
        [user2.address, taskId, claimAmount, 1337, user2.address, 1234567890]
      );
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      const initialBalance = await ethers.provider.getBalance(user2.address);

      const tx = await contract.connect(user2).claimRewardsOmnichainSecure(
        taskId,
        claimAmount,
        1337,
        user2.address,
        serverSignature
      );

      await expect(tx)
        .to.emit(contract, "RewardDistributedOmnichain")
        .withArgs(user2.address, claimAmount, ethers.ZeroAddress, 1337, 1337);

      const finalBalance = await ethers.provider.getBalance(user2.address);
      expect(finalBalance).to.be.greaterThan(initialBalance);
    });

    it("Should reject claims with invalid server signature", async function () {
      const claimAmount = ethers.parseEther("0.1");

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "uint256", "uint256", "address", "uint256"],
        [user2.address, taskId, claimAmount, 1337, user2.address, 1234567890]
      );
      const invalidSignature = await user1.signMessage(ethers.getBytes(messageHash)); // Wrong signer

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      await expect(
        contract.connect(user2).claimRewardsOmnichainSecure(
          taskId,
          claimAmount,
          1337,
          user2.address,
          invalidSignature
        )
      ).to.be.revertedWith("Invalid server signature");
    });

    it("Should reject claims exceeding remaining reward", async function () {
      const claimAmount = ethers.parseEther("1.5"); // More than total funded

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "uint256", "uint256", "address", "uint256"],
        [user2.address, taskId, claimAmount, 1337, user2.address, 1234567890]
      );
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      await expect(
        contract.connect(user2).claimRewardsOmnichainSecure(
          taskId,
          claimAmount,
          1337,
          user2.address,
          serverSignature
        )
      ).to.be.revertedWith("Insufficient remaining reward");
    });
  });

  describe("Cross-Chain Reward Distribution", function () {
    it("Should handle cross-chain reward claims", async function () {
      const claimAmount = ethers.parseEther("0.1");
      const targetChain = 1; // Ethereum mainnet

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "uint256", "uint256", "address", "uint256"],
        [user2.address, taskId, claimAmount, targetChain, user2.address, 1234567890]
      );
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      const tx = await contract.connect(user2).claimRewardsOmnichainSecure(
        taskId,
        claimAmount,
        targetChain,
        user2.address,
        serverSignature
      );

      // Should emit cross-chain reward event
      await expect(tx)
        .to.emit(contract, "RewardDistributedOmnichain")
        .withArgs(user2.address, claimAmount, ethers.ZeroAddress, 1337, targetChain);

      // Remaining reward should be updated
      const rewardCalc = await contract.getRewardCalculation(taskId);
      expect(rewardCalc.remainingReward).to.equal(ethers.parseEther("0.9"));
    });

    it("Should handle batch cross-chain distribution", async function () {
      const recipients = [user2.address, user3.address];
      const amounts = [ethers.parseEther("0.1"), ethers.parseEther("0.2")];
      const targetChains = [1, 56]; // Ethereum and BSC

      const messageHash = ethers.solidityPackedKeccak256(
        ["string", "address[]", "uint256[]", "uint256[]", "uint256"],
        [taskId, recipients, amounts, targetChains, 1234567890]
      );
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      const tx = await contract.connect(serverAddress).distributeRewardsOmnichain(
        taskId,
        recipients,
        amounts,
        targetChains,
        serverSignature
      );

      // Check cross-chain events
      await expect(tx)
        .to.emit(contract, "RewardDistributedOmnichain")
        .withArgs(user2.address, amounts[0], ethers.ZeroAddress, 1337, 1);

      await expect(tx)
        .to.emit(contract, "RewardDistributedOmnichain")
        .withArgs(user3.address, amounts[1], ethers.ZeroAddress, 1337, 56);
    });
  });

  describe("Audit Trail", function () {
    it("Should maintain complete audit trail of reward distributions", async function () {
      // Perform multiple reward operations
      const claimAmount1 = ethers.parseEther("0.1");
      const claimAmount2 = ethers.parseEther("0.2");

      // First claim
      const messageHash1 = ethers.solidityPackedKeccak256(
        ["address", "string", "uint256", "uint256", "address", "uint256"],
        [user2.address, taskId, claimAmount1, 1337, user2.address, 1234567890]
      );
      const serverSignature1 = await serverAddress.signMessage(ethers.getBytes(messageHash1));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      await contract.connect(user2).claimRewardsOmnichainSecure(
        taskId,
        claimAmount1,
        1337,
        user2.address,
        serverSignature1
      );

      // Second claim
      const messageHash2 = ethers.solidityPackedKeccak256(
        ["address", "string", "uint256", "uint256", "address", "uint256"],
        [user3.address, taskId, claimAmount2, 1, user3.address, 1234567891]
      );
      const serverSignature2 = await serverAddress.signMessage(ethers.getBytes(messageHash2));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567891]);

      await contract.connect(user3).claimRewardsOmnichainSecure(
        taskId,
        claimAmount2,
        1,
        user3.address,
        serverSignature2
      );

      // Check final state
      const rewardCalc = await contract.getRewardCalculation(taskId);
      expect(rewardCalc.totalFunded).to.equal(ethers.parseEther("1"));
      expect(rewardCalc.remainingReward).to.equal(ethers.parseEther("0.7"));
      expect(rewardCalc.distributedReward).to.equal(ethers.parseEther("0.3"));
    });

    it("Should track reward distribution across multiple tasks", async function () {
      // Create second task
      const taskSpec2 = {
        title: "Second Task",
        description: "Another test task",
        language: "es",
        dataType: "audio",
        criteria: "Audio criteria",
        rewardPerSubmission: ethers.parseEther("0.05"),
        totalReward: ethers.parseEther("0.5"),
        deadline: Math.floor(Date.now() / 1000) + 86400,
        maxSubmissions: 10,
        requiresValidation: true
      };

      await contract.connect(user1).createTaskOmnichain(
        taskSpec2,
        1337,
        ethers.ZeroAddress,
        ethers.parseEther("0.5"),
        { value: ethers.parseEther("0.5") }
      );

      const taskId2 = "task_2";

      // Distribute rewards from both tasks
      const claimAmount1 = ethers.parseEther("0.1");
      const claimAmount2 = ethers.parseEther("0.05");

      // Claim from first task
      const messageHash1 = ethers.solidityPackedKeccak256(
        ["address", "string", "uint256", "uint256", "address", "uint256"],
        [user2.address, taskId, claimAmount1, 1337, user2.address, 1234567890]
      );
      const serverSignature1 = await serverAddress.signMessage(ethers.getBytes(messageHash1));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567890]);

      await contract.connect(user2).claimRewardsOmnichainSecure(
        taskId,
        claimAmount1,
        1337,
        user2.address,
        serverSignature1
      );

      // Claim from second task
      const messageHash2 = ethers.solidityPackedKeccak256(
        ["address", "string", "uint256", "uint256", "address", "uint256"],
        [user2.address, taskId2, claimAmount2, 1337, user2.address, 1234567891]
      );
      const serverSignature2 = await serverAddress.signMessage(ethers.getBytes(messageHash2));

      await ethers.provider.send("evm_setNextBlockTimestamp", [1234567891]);

      await contract.connect(user2).claimRewardsOmnichainSecure(
        taskId2,
        claimAmount2,
        1337,
        user2.address,
        serverSignature2
      );

      // Check both tasks
      const rewardCalc1 = await contract.getRewardCalculation(taskId);
      const rewardCalc2 = await contract.getRewardCalculation(taskId2);

      expect(rewardCalc1.distributedReward).to.equal(ethers.parseEther("0.1"));
      expect(rewardCalc2.distributedReward).to.equal(ethers.parseEther("0.05"));
    });
  });
});