const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeLangZetaUniversal", function () {
  let contract;
  let owner;
  let serverAddress;
  let user1;
  let user2;
  let systemContract;

  beforeEach(async function () {
    [owner, serverAddress, user1, user2] = await ethers.getSigners();

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
  });

  describe("Task Creation", function () {
    it("Should create a task with valid parameters", async function () {
      const taskSpec = {
        title: "English Text Collection",
        description: "Collect high-quality English text data",
        language: "en",
        dataType: "text",
        criteria: "Minimum 100 words, grammatically correct",
        rewardPerSubmission: ethers.parseEther("0.1"),
        totalReward: ethers.parseEther("10"),
        deadline: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
        maxSubmissions: 100,
        requiresValidation: true
      };

      const tx = await contract.connect(user1).createTaskOmnichain(
        taskSpec,
        1337, // hardhat chain id
        ethers.ZeroAddress, // ETH payment
        ethers.parseEther("10"),
        { value: ethers.parseEther("10") }
      );

      await expect(tx)
        .to.emit(contract, "TaskCreatedOmnichain")
        .withArgs(
          "task_1",
          user1.address,
          1337,
          ethers.parseEther("10"),
          ethers.ZeroAddress
        );

      const task = await contract.getTask("task_1");
      expect(task.creator).to.equal(user1.address);
      expect(task.spec.title).to.equal("English Text Collection");
      expect(task.totalFunded).to.equal(ethers.parseEther("10"));
      expect(task.active).to.be.true;
    });

    it("Should reject task creation with invalid parameters", async function () {
      const taskSpec = {
        title: "Test Task",
        description: "Test description",
        language: "en",
        dataType: "text",
        criteria: "Test criteria",
        rewardPerSubmission: ethers.parseEther("0.1"),
        totalReward: ethers.parseEther("10"),
        deadline: Math.floor(Date.now() / 1000) - 3600, // Past deadline
        maxSubmissions: 100,
        requiresValidation: true
      };

      await expect(
        contract.connect(user1).createTaskOmnichain(
          taskSpec,
          1337,
          ethers.ZeroAddress,
          ethers.parseEther("10"),
          { value: ethers.parseEther("10") }
        )
      ).to.be.revertedWith("Deadline must be in the future");
    });

    it("Should reject task creation with insufficient payment", async function () {
      const taskSpec = {
        title: "Test Task",
        description: "Test description",
        language: "en",
        dataType: "text",
        criteria: "Test criteria",
        rewardPerSubmission: ethers.parseEther("0.1"),
        totalReward: ethers.parseEther("10"),
        deadline: Math.floor(Date.now() / 1000) + 86400,
        maxSubmissions: 100,
        requiresValidation: true
      };

      await expect(
        contract.connect(user1).createTaskOmnichain(
          taskSpec,
          1337,
          ethers.ZeroAddress,
          ethers.parseEther("10"),
          { value: ethers.parseEther("5") } // Insufficient payment
        )
      ).to.be.revertedWith("Incorrect ETH amount");
    });
  });

  describe("User Authentication", function () {
    it("Should generate valid authentication challenge", async function () {
      const user = user1.address;
      const nonce = 0;

      const challenge = await contract.generateUserAuthChallenge(user, nonce);

      expect(challenge).to.not.equal(ethers.ZeroHash);

      // Verify challenge is deterministic
      const challenge2 = await contract.generateUserAuthChallenge(user, nonce);
      expect(challenge).to.equal(challenge2);

      // Verify different nonce produces different challenge
      const challenge3 = await contract.generateUserAuthChallenge(user, nonce + 1);
      expect(challenge).to.not.equal(challenge3);
    });

    it("Should validate correct user authentication response", async function () {
      const user = user1.address;
      const nonce = 0;

      const challenge = await contract.generateUserAuthChallenge(user, nonce);
      const signature = await user1.signMessage(ethers.getBytes(challenge));

      const isValid = await contract.validateUserAuthResponse(user, challenge, signature);
      expect(isValid).to.be.true;
    });

    it("Should reject invalid user authentication response", async function () {
      const user = user1.address;
      const nonce = 0;

      const challenge = await contract.generateUserAuthChallenge(user, nonce);
      const wrongSignature = await user2.signMessage(ethers.getBytes(challenge));

      const isValid = await contract.validateUserAuthResponse(user, challenge, wrongSignature);
      expect(isValid).to.be.false;
    });

    it("Should update user nonce only by server", async function () {
      const initialNonce = await contract.userNonces(user1.address);

      await contract.connect(serverAddress).updateUserNonce(user1.address);

      const updatedNonce = await contract.userNonces(user1.address);
      expect(updatedNonce).to.equal(initialNonce + 1n);
    });

    it("Should reject nonce update from non-server address", async function () {
      await expect(
        contract.connect(user1).updateUserNonce(user1.address)
      ).to.be.revertedWith("Only server can update nonce");
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to update server address", async function () {
      const newServerAddress = user1.address;

      const tx = await contract.connect(owner).updateServerAddress(newServerAddress);

      await expect(tx)
        .to.emit(contract, "ServerAddressUpdated")
        .withArgs(serverAddress.address, newServerAddress);

      expect(await contract.serverAddress()).to.equal(newServerAddress);
    });

    it("Should reject server address update from non-owner", async function () {
      await expect(
        contract.connect(user1).updateServerAddress(user2.address)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("Should allow task creator to pause/unpause task", async function () {
      // Create task
      const taskSpec = {
        title: "Test Task",
        description: "Test description",
        language: "en",
        dataType: "text",
        criteria: "Test criteria",
        rewardPerSubmission: ethers.parseEther("0.1"),
        totalReward: ethers.parseEther("10"),
        deadline: Math.floor(Date.now() / 1000) + 86400,
        maxSubmissions: 100,
        requiresValidation: true
      };

      await contract.connect(user1).createTaskOmnichain(
        taskSpec,
        1337,
        ethers.ZeroAddress,
        ethers.parseEther("10"),
        { value: ethers.parseEther("10") }
      );

      // Pause task
      await contract.connect(user1).setTaskActive("task_1", false);
      let task = await contract.getTask("task_1");
      expect(task.active).to.be.false;

      // Unpause task
      await contract.connect(user1).setTaskActive("task_1", true);
      task = await contract.getTask("task_1");
      expect(task.active).to.be.true;
    });

    it("Should reject task pause from unauthorized user", async function () {
      // Create task
      const taskSpec = {
        title: "Test Task",
        description: "Test description",
        language: "en",
        dataType: "text",
        criteria: "Test criteria",
        rewardPerSubmission: ethers.parseEther("0.1"),
        totalReward: ethers.parseEther("10"),
        deadline: Math.floor(Date.now() / 1000) + 86400,
        maxSubmissions: 100,
        requiresValidation: true
      };

      await contract.connect(user1).createTaskOmnichain(
        taskSpec,
        1337,
        ethers.ZeroAddress,
        ethers.parseEther("10"),
        { value: ethers.parseEther("10") }
      );

      await expect(
        contract.connect(user2).setTaskActive("task_1", false)
      ).to.be.revertedWith("Only task creator or owner can modify task");
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      // Create multiple tasks for testing
      const taskSpec = {
        title: "Test Task",
        description: "Test description",
        language: "en",
        dataType: "text",
        criteria: "Test criteria",
        rewardPerSubmission: ethers.parseEther("0.1"),
        totalReward: ethers.parseEther("1"), // Reduced to match reward per submission * max submissions
        deadline: Math.floor(Date.now() / 1000) + 86400,
        maxSubmissions: 10, // Reduced to match total reward
        requiresValidation: true
      };

      // Create two tasks
      await contract.connect(user1).createTaskOmnichain(
        taskSpec,
        1337,
        ethers.ZeroAddress,
        ethers.parseEther("1"),
        { value: ethers.parseEther("1") }
      );

      const taskSpec2 = {
        ...taskSpec,
        maxSubmissions: 5 // 0.1 * 5 = 0.5 ETH total
      };

      await contract.connect(user1).createTaskOmnichain(
        taskSpec2,
        1337,
        ethers.ZeroAddress,
        ethers.parseEther("0.5"),
        { value: ethers.parseEther("0.5") }
      );
    });

    it("Should return user tasks correctly", async function () {
      const userTasks = await contract.getUserTasks(user1.address);
      expect(userTasks.length).to.equal(2);
      expect(userTasks[0]).to.equal("task_1");
      expect(userTasks[1]).to.equal("task_2");
    });
  });

  describe("Data Submission", function () {
    let taskId;

    beforeEach(async function () {
      // Get current block timestamp and add sufficient buffer for deadline
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 86400; // 24 hours from current block

      const taskSpec = {
        title: "Test Task",
        description: "Test description",
        language: "en",
        dataType: "text",
        criteria: "Test criteria",
        rewardPerSubmission: ethers.parseEther("0.1"),
        totalReward: ethers.parseEther("1"),
        deadline: deadline,
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

    it("Should submit data with valid server signature", async function () {
      const storageUrl = "https://storage.googleapis.com/bucket/file.txt";
      const metadata = JSON.stringify({ wordCount: 150, language: "en" });
      const preferredRewardChain = 1; // Ethereum

      // Get current block timestamp and add some buffer
      const block = await ethers.provider.getBlock("latest");
      const timestamp = block.timestamp + 10; // Add buffer for transaction processing

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "string", "uint256", "uint256"],
        [user2.address, taskId, storageUrl, metadata, preferredRewardChain, timestamp]
      );

      // Sign with server private key
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      // Set the next block timestamp
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      const submitTx = await contract.connect(user2).submitDataOmnichainSecure(
        taskId,
        storageUrl,
        metadata,
        preferredRewardChain,
        serverSignature
      );

      await expect(submitTx)
        .to.emit(contract, "DataSubmittedOmnichain")
        .withArgs(
          "sub_task_1_1",
          taskId,
          user2.address,
          storageUrl,
          preferredRewardChain
        );

      const submission = await contract.getSubmission("sub_task_1_1");
      expect(submission.contributor).to.equal(user2.address);
      expect(submission.storageUrl).to.equal(storageUrl);
      expect(submission.verified).to.be.false;
    });

    it("Should reject submission with invalid server signature", async function () {
      const storageUrl = "https://storage.googleapis.com/bucket/file.txt";
      const metadata = JSON.stringify({ wordCount: 150, language: "en" });
      const preferredRewardChain = 1;

      // Create invalid signature (signed by wrong address)
      const block = await ethers.provider.getBlock("latest");
      const timestamp = block.timestamp + 10;

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "string", "uint256", "uint256"],
        [user2.address, taskId, storageUrl, metadata, preferredRewardChain, timestamp]
      );
      const invalidSignature = await user1.signMessage(ethers.getBytes(messageHash));

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(
        contract.connect(user2).submitDataOmnichainSecure(
          taskId,
          storageUrl,
          metadata,
          preferredRewardChain,
          invalidSignature
        )
      ).to.be.revertedWith("Invalid server signature");
    });

    it("Should reject submission to inactive task", async function () {
      // Deactivate task
      await contract.connect(user1).setTaskActive(taskId, false);

      const storageUrl = "https://storage.googleapis.com/bucket/file.txt";
      const metadata = JSON.stringify({ wordCount: 150, language: "en" });
      const preferredRewardChain = 1;

      const block = await ethers.provider.getBlock("latest");
      const timestamp = block.timestamp + 1;

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "string", "uint256", "uint256"],
        [user2.address, taskId, storageUrl, metadata, preferredRewardChain, timestamp]
      );
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      await ethers.provider.send("evm_mine", [timestamp]);

      await expect(
        contract.connect(user2).submitDataOmnichainSecure(
          taskId,
          storageUrl,
          metadata,
          preferredRewardChain,
          serverSignature
        )
      ).to.be.revertedWith("Task is not active");
    });

    it("Should reject submission after deadline", async function () {
      // Fast forward time past deadline
      const task = await contract.getTask(taskId);
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number(task.spec.deadline) + 1]);

      const storageUrl = "https://storage.googleapis.com/bucket/file.txt";
      const metadata = JSON.stringify({ wordCount: 150, language: "en" });
      const preferredRewardChain = 1;

      const timestamp = Number(task.spec.deadline) + 1;
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "string", "uint256", "uint256"],
        [user2.address, taskId, storageUrl, metadata, preferredRewardChain, timestamp]
      );
      const serverSignature = await serverAddress.signMessage(ethers.getBytes(messageHash));

      await expect(
        contract.connect(user2).submitDataOmnichainSecure(
          taskId,
          storageUrl,
          metadata,
          preferredRewardChain,
          serverSignature
        )
      ).to.be.revertedWith("Task deadline has passed");
    });

    it("Should track submissions correctly", async function () {
      const storageUrl = "https://storage.googleapis.com/bucket/file.txt";
      const metadata = JSON.stringify({ wordCount: 150, language: "en" });
      const preferredRewardChain = 1;

      // Submit first data
      const block1 = await ethers.provider.getBlock("latest");
      const timestamp1 = block1.timestamp + 1;

      const messageHash1 = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "string", "uint256", "uint256"],
        [user2.address, taskId, storageUrl, metadata, preferredRewardChain, timestamp1]
      );
      const serverSignature1 = await serverAddress.signMessage(ethers.getBytes(messageHash1));

      await ethers.provider.send("evm_mine", [timestamp1]);

      await contract.connect(user2).submitDataOmnichainSecure(
        taskId,
        storageUrl,
        metadata,
        preferredRewardChain,
        serverSignature1
      );

      // Submit second data from different user
      const block2 = await ethers.provider.getBlock("latest");
      const timestamp2 = block2.timestamp + 1;

      const messageHash2 = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "string", "uint256", "uint256"],
        [user1.address, taskId, storageUrl + "2", metadata, preferredRewardChain, timestamp2]
      );
      const serverSignature2 = await serverAddress.signMessage(ethers.getBytes(messageHash2));

      await ethers.provider.send("evm_mine", [timestamp2]);

      await contract.connect(user1).submitDataOmnichainSecure(
        taskId,
        storageUrl + "2",
        metadata,
        preferredRewardChain,
        serverSignature2
      );

      // Check task submissions
      const taskSubmissions = await contract.getTaskSubmissions(taskId);
      expect(taskSubmissions.length).to.equal(2);
      expect(taskSubmissions[0]).to.equal("sub_task_1_1");
      expect(taskSubmissions[1]).to.equal("sub_task_1_2");

      // Check user submissions
      const user2Submissions = await contract.getUserSubmissions(user2.address);
      expect(user2Submissions.length).to.equal(1);
      expect(user2Submissions[0]).to.equal("sub_task_1_1");

      const user1Submissions = await contract.getUserSubmissions(user1.address);
      expect(user1Submissions.length).to.equal(1);
      expect(user1Submissions[0]).to.equal("sub_task_1_2");

      // Check task submission count
      const updatedTask = await contract.getTask(taskId);
      expect(updatedTask.submissionCount).to.equal(2);
    });

    it("Should reject submission when max submissions reached", async function () {
      // Create a task with max 1 submission
      const taskSpec = {
        title: "Limited Task",
        description: "Test description",
        language: "en",
        dataType: "text",
        criteria: "Test criteria",
        rewardPerSubmission: ethers.parseEther("0.1"),
        totalReward: ethers.parseEther("0.1"),
        deadline: Math.floor(Date.now() / 1000) + 86400,
        maxSubmissions: 1,
        requiresValidation: true
      };

      await contract.connect(user1).createTaskOmnichain(
        taskSpec,
        1337,
        ethers.ZeroAddress,
        ethers.parseEther("0.1"),
        { value: ethers.parseEther("0.1") }
      );

      const limitedTaskId = "task_2";
      const storageUrl = "https://storage.googleapis.com/bucket/file.txt";
      const metadata = JSON.stringify({ wordCount: 150, language: "en" });
      const preferredRewardChain = 1;

      // Submit first data (should succeed)
      const block1 = await ethers.provider.getBlock("latest");
      const timestamp1 = block1.timestamp + 1;

      const messageHash1 = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "string", "uint256", "uint256"],
        [user2.address, limitedTaskId, storageUrl, metadata, preferredRewardChain, timestamp1]
      );
      const serverSignature1 = await serverAddress.signMessage(ethers.getBytes(messageHash1));

      await ethers.provider.send("evm_mine", [timestamp1]);

      await contract.connect(user2).submitDataOmnichainSecure(
        limitedTaskId,
        storageUrl,
        metadata,
        preferredRewardChain,
        serverSignature1
      );

      // Try to submit second data (should fail)
      const block2 = await ethers.provider.getBlock("latest");
      const timestamp2 = block2.timestamp + 1;

      const messageHash2 = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "string", "uint256", "uint256"],
        [user1.address, limitedTaskId, storageUrl + "2", metadata, preferredRewardChain, timestamp2]
      );
      const serverSignature2 = await serverAddress.signMessage(ethers.getBytes(messageHash2));

      await ethers.provider.send("evm_mine", [timestamp2]);

      await expect(
        contract.connect(user1).submitDataOmnichainSecure(
          limitedTaskId,
          storageUrl + "2",
          metadata,
          preferredRewardChain,
          serverSignature2
        )
      ).to.be.revertedWith("Task submission limit reached");
    });
  });
});

// Mock SystemContract for testing
describe("MockSystemContract", function () {
  async function deployMockSystemContract() {
    const MockSystemContract = await ethers.getContractFactory("MockSystemContract");
    const mockSystemContract = await MockSystemContract.deploy();
    await mockSystemContract.waitForDeployment();
    return mockSystemContract;
  }

  it("Should deploy mock system contract", async function () {
    const mockSystemContract = await deployMockSystemContract();
    expect(await mockSystemContract.getAddress()).to.not.equal(ethers.ZeroAddress);
  });
});