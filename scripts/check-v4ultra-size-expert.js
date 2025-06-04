const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🔍 V4ULTRA CONTRACT SIZE ANALYSIS");
    console.log("==================================");
    
    try {
        // Check if artifact exists
        const artifactPath = './artifacts/contracts/OrphiCrowdFundV4Ultra.sol/OrphiCrowdFundV4Ultra.json';
        
        if (!fs.existsSync(artifactPath)) {
            console.log("❌ V4Ultra artifact not found. Compiling...");
            
            // Try to compile with specific hardhat config
            const { exec } = require('child_process');
            await new Promise((resolve, reject) => {
                exec('npx hardhat compile --config hardhat.v4ultra-size.config.js', (error, stdout, stderr) => {
                    if (error) {
                        console.log("Compilation output:", stdout);
                        console.log("Compilation errors:", stderr);
                        reject(error);
                    } else {
                        console.log("✅ Compilation successful");
                        resolve();
                    }
                });
            });
        }
        
        if (fs.existsSync(artifactPath)) {
            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            const bytecode = artifact.bytecode;
            const sizeInBytes = (bytecode.length - 2) / 2; // Remove 0x prefix and divide by 2
            const sizeInKB = (sizeInBytes / 1024).toFixed(1);
            
            console.log(`\n📊 V4ULTRA CONTRACT ANALYSIS:`);
            console.log(`Size: ${sizeInBytes} bytes (${sizeInKB}KB)`);
            console.log(`24KB Limit: 24,576 bytes`);
            console.log(`Under Limit: ${sizeInBytes < 24576 ? '✅ YES' : '❌ NO'}`);
            console.log(`Remaining: ${24576 - sizeInBytes} bytes`);
            
            if (sizeInBytes < 24576) {
                console.log("\n🎉 CONTRACT SIZE OPTIMIZATION SUCCESSFUL!");
                console.log("✅ Ready for Ethereum Mainnet deployment");
            } else {
                console.log("\n⚠️ CONTRACT STILL OVER SIZE LIMIT");
                console.log("❌ Further optimization required");
                console.log("\n🔧 RECOMMENDED OPTIMIZATIONS:");
                console.log("1. Move complex functions to libraries");
                console.log("2. Reduce string constants");
                console.log("3. Pack more structs");
                console.log("4. Use custom errors instead of require strings");
            }
            
        } else {
            console.log("❌ Failed to find V4Ultra artifact after compilation");
        }
        
    } catch (error) {
        console.error("❌ Error during analysis:", error.message);
        
        // Fallback: try to check if contract files exist
        const contractPath = './contracts/OrphiCrowdFundV4Ultra.sol';
        if (fs.existsSync(contractPath)) {
            const contractContent = fs.readFileSync(contractPath, 'utf8');
            const lines = contractContent.split('\n').length;
            console.log(`\n📄 CONTRACT FILE ANALYSIS:`);
            console.log(`Lines: ${lines}`);
            console.log(`Size estimate: ~${Math.round(lines * 50)} bytes (rough estimate)`);
        }
    }
}

main().catch(console.error);
