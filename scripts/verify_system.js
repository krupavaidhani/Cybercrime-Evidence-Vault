const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    // 1. Check Contract
    const config = JSON.parse(fs.readFileSync("./app/contractConfig.json", "utf8"));
    console.log("Checking contract at:", config.address);
    // Use Hardhat's provider which is already connected to 'localhost' via --network flag
    const code = await ethers.provider.getCode(config.address);
    console.log("Contract Code Length:", code.length);

    if (code === "0x") {
        console.log("❌ NO CONTRACT FOUND AT ADDRESS! (Deployment Mismatch)");
        process.exit(1);
    } else {
        console.log("✅ Contract Code Exists!");
        // Try calling default SO_ROLE
        try {
            const EvidenceVault = await ethers.getContractFactory("EvidenceVault");
            const vault = EvidenceVault.attach(config.address);
            const SO_ROLE = await vault.SO_ROLE();
            console.log("✅ Contract Call (SO_ROLE) Successful:", SO_ROLE);
        } catch (e) {
            console.error("❌ Contract Call Failed:", e.message);
            process.exit(1);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
