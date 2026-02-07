const hre = require("hardhat");
const fs = require("fs");
const dotenv = require("dotenv");
const path = require("path");

// Verbose .env Loading Debug
console.log("Loading .env file...");
const envResult = dotenv.config({ path: path.resolve(__dirname, "../.env") });
if (envResult.error) console.log(".env load error (expected if missing):", envResult.error.message);

if (!process.env.PRIVATE_KEY) {
    console.log("PRIVATE_KEY missing, trying .env.local...");
    const localPath = path.resolve(__dirname, "../.env.local");
    console.log("Looking for .env.local at:", localPath);

    if (fs.existsSync(localPath)) {
        const localResult = dotenv.config({ path: localPath });
        if (localResult.error) {
            console.error("❌ .env.local load error:", localResult.error);
        } else {
            console.log("✅ .env.local loaded.");
            // Log KEY presence safely
            if (process.env.PRIVATE_KEY) {
                console.log(`✅ PRIVATE_KEY found (Length: ${process.env.PRIVATE_KEY.length})`);
            } else {
                console.error("❌ PRIVATE_KEY NOT found in process.env after loading .env.local");
            }
        }
    } else {
        console.error("❌ .env.local file NOT found at path:", localPath);
    }
}


async function main() {
    console.log("Starting EvidenceVault Deployment...");
    console.log("Network:", hre.network.name);

    try {
        let deployer;
        const PRIVATE_KEY = process.env.PRIVATE_KEY;

        if (hre.network.name === "amoy" && PRIVATE_KEY) {
            console.log("Using Manual Wallet from PRIVATE_KEY...");
            const provider = hre.ethers.provider;
            deployer = new hre.ethers.Wallet(PRIVATE_KEY, provider);
        } else {
            // Fallback to Hardhat config accounts (e.g., localhost)
            [deployer] = await hre.ethers.getSigners();
        }

        if (!deployer) {
            throw new Error("No deployer account found. Check PRIVATE_KEY in .env/.env.local.");
        }

        console.log("Deploying with Account:", deployer.address);

        // Check Balance
        const balance = await hre.ethers.provider.getBalance(deployer.address);
        console.log("Account Balance:", hre.ethers.formatEther(balance), "ETH/MATIC");

        // 1. Deploy Contract
        console.log("Deploying Contract...");
        const EvidenceVault = await hre.ethers.getContractFactory("EvidenceVault");
        // Use connect(deployer) explicitly if creating manual wallet
        const vault = await EvidenceVault.connect(deployer).deploy();

        // 2. Wait for Deployment
        console.log("Waiting for confirmation...");
        await vault.waitForDeployment();

        // 3. Get Address
        const address = await vault.getAddress();
        console.log("---------------------------------------------");
        console.log(`✅ EvidenceVault Deployed to: ${address}`);
        console.log("---------------------------------------------");

        // 4. Configure Roles
        console.log("Configuring Roles for Deployer (Super User)...");
        const IO_ROLE = await vault.IO_ROLE();
        const SO_ROLE = await vault.SO_ROLE();
        const CUSTODIAN_ROLE = await vault.CUSTODIAN_ROLE();
        const EXAMINER_ROLE = await vault.EXAMINER_ROLE();
        const HOD_ROLE = await vault.HOD_ROLE();

        // Must connect again just to be safe, though instance should have signer
        const vaultWithSigner = vault.connect(deployer);

        await (await vaultWithSigner.grantRole(IO_ROLE, deployer.address)).wait();
        await (await vaultWithSigner.grantRole(SO_ROLE, deployer.address)).wait();
        await (await vaultWithSigner.grantRole(CUSTODIAN_ROLE, deployer.address)).wait();
        await (await vaultWithSigner.grantRole(EXAMINER_ROLE, deployer.address)).wait();
        await (await vaultWithSigner.grantRole(HOD_ROLE, deployer.address)).wait();
        console.log("Roles Granted to Deployer.");

        // 5. Generate Artifacts
        console.log("Generating Frontend Config...");
        const artifactPath = "./artifacts/contracts/EvidenceVault.sol/EvidenceVault.json";
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

        const config = {
            address: address,
            deploymentBlock: await vault.deploymentTransaction().getBlock().then(b => b.number),
            abi: artifact.abi
        };

        fs.writeFileSync("./app/contractConfig.json", JSON.stringify(config, null, 2));
        console.log("✅ Config written to app/contractConfig.json");

    } catch (error) {
        console.error("❌ Deployment Failed:");
        console.error(error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
