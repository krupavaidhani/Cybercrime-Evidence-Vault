require("@nomicfoundation/hardhat-toolbox");

// Load .env OR .env.local
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });
if (!process.env.PRIVATE_KEY) {
    dotenv.config({ path: ".env.local" }); // Fallback for Next.js users
}

// Ensure PRIVATE_KEY is loaded
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
    console.error("⚠️ PRIVATE_KEY not found in .env or .env.local. Smart contract deployment will fail on non-local networks.");
} else {
    console.log(`✅ Loaded PRIVATE_KEY (Length: ${PRIVATE_KEY.length})`);
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    paths: {
        artifacts: "./artifacts",
    },
    networks: {
        hardhat: {
            chainId: 1337,
        },
        amoy: {
            url: "https://rpc-amoy.polygon.technology/",
            chainId: 80002,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            gasPrice: "auto"
        }
    },
    sourcify: {
        enabled: false
    },
    etherscan: {
        apiKey: process.env.POLYGONSCAN_API_KEY,
        customChains: [
            {
                network: "amoy",
                chainId: 80002,
                urls: {
                    apiURL: "https://api.etherscan.io/v2/api?chainid=80002",
                    browserURL: "https://amoy.polygonscan.com"
                }
            }
        ]
    }
};
