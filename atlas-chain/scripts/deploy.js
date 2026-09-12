const hre = require("hardhat");

async function main() {
  const AuditRegistry = await hre.ethers.getContractFactory("AuditRegistry");
  const contract = await AuditRegistry.deploy();
  await contract.waitForDeployment();
  console.log("AuditRegistry deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
