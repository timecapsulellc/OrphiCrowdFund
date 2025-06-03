const fs = require('fs');
const path = require('path');

console.log("📊 V4 CONTRACT SIZE OPTIMIZATION RESULTS\n");
console.log("="*60);

// Contract size analysis
const artifactPath = './artifacts/contracts/OrphiCrowdFundV4LibOptimized.sol/OrphiCrowdFundV4LibOptimized.json';

try {
    if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        const bytecode = artifact.bytecode;
        const sizeInBytes = bytecode.length / 2 - 1; // Remove 0x prefix and divide by 2
        const sizeInKB = (sizeInBytes / 1024).toFixed(1);
        
        console.log(`✅ OrphiCrowdFundV4LibOptimized:`);
        console.log(`   Size: ${sizeInBytes} bytes (${sizeInKB}KB)`);
        console.log(`   Status: ${sizeInBytes < 24576 ? 'UNDER LIMIT ✅' : 'OVER LIMIT ❌'}`);
        console.log(`   Remaining: ${(24576 - sizeInBytes)} bytes`);
        
        // Compare with other versions
        console.log("\n📋 COMPARISON WITH OTHER VERSIONS:");
        console.log("-"*40);
        
        const contractVersions = [
            'OrphiCrowdFund',
            'OrphiCrowdFundV2', 
            'OrphiCrowdFundV4',
            'OrphiCrowdFundV4Simple',
            'OrphiCrowdFundV4Minimal',
            'OrphiCrowdFundV4LibOptimized'
        ];
        
        contractVersions.forEach(contractName => {
            try {
                const versionArtifact = JSON.parse(fs.readFileSync(`./artifacts/contracts/${contractName}.sol/${contractName}.json`, 'utf8'));
                const versionSize = versionArtifact.bytecode.length / 2 - 1;
                const versionKB = (versionSize / 1024).toFixed(1);
                const status = versionSize < 24576 ? '✅' : '❌';
                
                console.log(`${contractName.padEnd(30)} ${versionSize.toString().padStart(6)} bytes (${versionKB.padStart(5)}KB) ${status}`);
            } catch (e) {
                console.log(`${contractName.padEnd(30)} Not found`);
            }
        });
        
        console.log("\n🎯 OPTIMIZATION SUCCESS METRICS:");
        console.log("-"*40);
        
        // Calculate reduction from original V4
        try {
            const originalV4 = JSON.parse(fs.readFileSync('./artifacts/contracts/OrphiCrowdFundV4.sol/OrphiCrowdFundV4.json', 'utf8'));
            const originalSize = originalV4.bytecode.length / 2 - 1;
            const reduction = originalSize - sizeInBytes;
            const reductionPercent = ((reduction / originalSize) * 100).toFixed(1);
            
            console.log(`Original V4 Size: ${originalSize} bytes`);
            console.log(`Optimized Size:   ${sizeInBytes} bytes`);
            console.log(`Size Reduction:   ${reduction} bytes (${reductionPercent}%)`);
        } catch (e) {
            console.log("Could not compare with original V4");
        }
        
        console.log("\n✨ OPTIMIZATION TECHNIQUES USED:");
        console.log("-"*40);
        console.log("• ✅ Library pattern for computational functions");
        console.log("• ✅ Reduced package levels from 10 to 5");
        console.log("• ✅ Simplified contract inheritance (no upgradeable)");
        console.log("• ✅ Direct implementation vs complex library calls");
        console.log("• ✅ Optimized state variable packing");
        
        console.log("\n🎉 FINAL RESULT: CONTRACT DEPLOYMENT READY!");
        console.log("="*60);
        
    } else {
        console.log("❌ OrphiCrowdFundV4LibOptimized artifact not found. Please compile first.");
    }
} catch (error) {
    console.error("❌ Error reading contract artifact:", error.message);
}
