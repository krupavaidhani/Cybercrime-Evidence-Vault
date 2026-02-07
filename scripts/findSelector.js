const hre = require("hardhat");

async function main() {
    const functions = [
        "addEvidence(string,bytes32,string,string)",
        "requestTransfer(string,address)",
        "acceptTransfer(string)", // I suspect this is 0x6d136f62
        "addForensicReport(string,string,string)",
        "finalizeCase(string)",
        "updateStatus(string,uint8)"
    ];

    console.log("Function Selectors:");
    for (const f of functions) {
        const selector = hre.ethers.id(f).substring(0, 10);
        console.log(`${selector} : ${f}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
