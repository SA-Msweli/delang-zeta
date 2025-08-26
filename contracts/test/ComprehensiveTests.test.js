const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeLangZetaUniversal - Comprehensive Task Requirements Tests", function () {
  let contract;
  let owner;
  let serverAddress;
  let user1;
  let user2;
  let user3;
  let systemContract;

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
  });

  describe("Task 3.1: Enhanced Universal Smart Contract with Server Validation", function () {
    describe("createTaskOmnichain Function", function () {
      it("Should create task with ETH payment (cross-chain simulation)", async function () {
        const taskSpec = {
          title: "Cross-Chain Task",
          description: "Test cross-chain functionality",
          language: "en",
          dataType: "text",
          criteria: "Test criteria",
          rewardPerSubmission: ethers.parseEther("0.1"),
          totalReward: ethers.parseEther("1"),
          deadline: Math.floor(Date.now() / 1000) + 86400,
          maxSubmissions: 10,
          requiresValidation: true
        };

        const tx = await contract.connect(user1).createTaskOmnichain(
          taskSpec,
          1, // Ethereum mainnet (cross-chain)
          ethers.ZeroAddress, // ETH payment
          ethers.parseEther("1"),
          { value: ethers.parseEther("1") }
        );

        await expect(tx)
          .to.emit(contract, "TaskCreatedOmnichain")
          .withArgs("task_1", user1.address, 1, ethers.parseEther("1"), ethers.ZeroAddress);

        const task = await contract.getTask("task_1");
        expect(task.sourceChainId).to.equal(1); // Cross-chain source
        expect(task.paymentToken).to.equal(ethers.ZeroAddress); // ETH
        expect(task.totalFunded).to.equal(ethers.parseEther("1"));
      });

      it("Should support different payment tokens (USDC simulation)", async function () {
        // Deploy mock ERC20 token to simulate USDC
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
        await mockUSDC.waitForDeployment();

        // Mint tokens to user
        await mockUSDC.mint(user1.address, ethers.parseUnits("1000", 6));
        await mockUSDC.connect(user1).approve(await contract.getAddress(), ethers.parseUnits("100", 6));

        const taskSpec = {
          title: "USDC Task",
          description: "Test USDC payment",
          language: "en",
          dataType: "text",
          criteria: "Test criteria",
          rewardPerSubmission: ethers.parseUnits("1", 6), // 1 USDC
          totalReward: ethers.parseUnits("10", 6), // 10 USDC
          deadline: Math.floor(Date.now() / 1000) + 86400,
          maxSubmissions: 10,
          requiresValidation: true
        };

        const tx = await contract.connect(user1).createTaskOmnichain(
          taskSpec,
          1337, // Same chain
          await mockUSDC.getAddress(),
          ethers.parseUnits("10", 6)
        );

        await expect(tx)
          .to.emit(contract, "TaskCreatedOmnichain")
          .withArgs("task_1", user1.address, 1337, ethers.parseUnits("10", 6), await mockUSDC.getAddress());
      });
    });

    describe("Server Signature Validation for Critical Operations", function () {
      let taskId;

      beforeEach(async function () {
        const taskSpec = {
          title: "Test Task",
          description: "Test description",
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

      it("Should validate server signature for verification results", async function () {
        const submissionId = "sub_task_1_1";
        const qualityScore = 85;
        const approved = true;

        // Create proper message hash
        const messageHash = ethers.solidityPackedKeccak256(
          ["string", "uint256", "bool", "uint256"],
          [submissionId, qualityScore, approved, Math.floor(Date.now() / 1000)]
        );

        const validSignature =