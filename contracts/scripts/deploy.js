const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying DeLangZeta Universal Smart Contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy MockSystemContract for testing (replace with actual SystemContract address on mainnet)
  const MockSystemContract = await ethers.getContractFactory("MockSystemContract");
  const systemContract = await MockSystemContract.deploy();
  await systemContract.waitForDeployment();
  console.log("MockSystemContract deployed to:", await systemContract.getAddress());

  // Set server address (replace with actual server address)
  const serverAddress = process.env.SERVER_ADDRESS || deployer.address;
  console.log("Using server address:", serverAddress);

  // Deploy DeLangZetaUniversal contract
  const DeLangZetaUniversal = await ethers.getContractFactory("DeLangZetaUniversal");
  const contract = await DeLangZetaUniversal.deploy(
    await systemContract.getAddress(),
    serverAddress
  );
  await contract.waitForDeployment();

  console.log("DeLangZetaUniversal deployed to:", await contract.getAddress());
  console.log("Constructor arguments:");
  console.log("- SystemContract:", await systemContract.getAddress());
  console.log("- ServerAddress:", serverAddress);

  // Verify deployment
  const owner = await contract.owner();
  const server = await contract.serverAddress();
  console.log("Contract owner:", owner);
  console.log("Server address:", server);

  console.log("\nDeployment completed successfully!");
  console.log("Contract address:", await contract.getAddress());

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: await contract.getAddress(),
    systemContractAddress: await systemContract.getAddress(),
    serverAddress: serverAddress,
    deployerAddress: deployer.address,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment Info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });