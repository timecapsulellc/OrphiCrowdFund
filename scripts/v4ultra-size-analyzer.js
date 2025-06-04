const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Expert contract size analyzer
async function analyzeContractSize() {
    console.log("🔍 V4ULTRA CONTRACT SIZE ANALYZER");
    console.log("==================================");
    
    try {
        // Read the contract files
        const ultraPath = path.resolve('./standalone-v4ultra/OrphiCrowdFundV4Ultra.sol');
        const interfacesPath = path.resolve('./standalone-v4ultra/MockInterfaces.sol');
        
        const ultraContent = fs.readFileSync(ultraPath, 'utf8');
        const interfacesContent = fs.readFileSync(interfacesPath, 'utf8');
        
        // Configure compiler input
        const input = {
            language: 'Solidity',
            sources: {
                'MockInterfaces.sol': {
                    content: interfacesContent
                },
                'OrphiCrowdFundV4Ultra.sol': {
                    content: ultraContent
                }
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['*']
                    }
                },
                optimizer: {
                    enabled: true,
                    runs: 1  // Optimize for size
                }
            }
        };
        
        // Compile
        console.log("Compiling contracts...");
        const output = JSON.parse(solc.compile(JSON.stringify(input)));
        
        // Check for errors
        if (output.errors) {
            output.errors.forEach(error => {
                console.log(error.severity + ': ' + error.formattedMessage);
            });
            
            if (output.errors.some(error => error.severity === 'error')) {
                console.log("Compilation failed with errors.");
                return;
            }
        }
        
        // Get bytecode
        const bytecode = output.contracts['OrphiCrowdFundV4Ultra.sol']['OrphiCrowdFundV4Ultra'].evm.bytecode.object;
        const sizeInBytes = bytecode.length / 2;
        const sizeInKB = (sizeInBytes / 1024).toFixed(1);
        
        console.log(`\n📊 V4ULTRA CONTRACT ANALYSIS:`);
        console.log(`Size: ${sizeInBytes} bytes (${sizeInKB}KB)`);
        console.log(`24KB Limit: 24,576 bytes`);
        console.log(`Under Limit: ${sizeInBytes < 24576 ? '✅ YES' : '❌ NO'}`);
        
        if (sizeInBytes < 24576) {
            console.log(`Remaining: ${24576 - sizeInBytes} bytes`);
            console.log("\n🎉 CONTRACT SIZE OPTIMIZATION SUCCESSFUL!");
            console.log("✅ Ready for Ethereum Mainnet deployment");
        } else {
            console.log(`Excess: ${sizeInBytes - 24576} bytes`);
            console.log("\n⚠️ CONTRACT STILL OVER SIZE LIMIT");
            console.log("❌ Further optimization required");
            
            // Provide optimization recommendations
            console.log("\n🔧 OPTIMIZATION RECOMMENDATIONS:");
            console.log("1. Replace require messages with custom errors (-500-1000 bytes)");
            console.log("2. Use shorter event names (-100-200 bytes)");
            console.log("3. Combine similar functions (-300-500 bytes)");
            console.log("4. Move complex logic to libraries (-1000-2000 bytes)");
            console.log("5. Reduce the number of tiers or features (-500-1000 bytes)");
        }
        
        // Additional analysis
        const codeLines = ultraContent.split('\n').length;
        const functions = (ultraContent.match(/function\s+\w+/g) || []).length;
        const events = (ultraContent.match(/event\s+\w+/g) || []).length;
        const structs = (ultraContent.match(/struct\s+\w+/g) || []).length;
        const mappings = (ultraContent.match(/mapping\s*\(/g) || []).length;
        
        console.log("\n📝 CODE ANALYSIS:");
        console.log(`Total Lines: ${codeLines}`);
        console.log(`Functions: ${functions}`);
        console.log(`Events: ${events}`);
        console.log(`Structs: ${structs}`);
        console.log(`Mappings: ${mappings}`);
        
        return {
            sizeInBytes,
            sizeInKB,
            isUnderLimit: sizeInBytes < 24576,
            codeStats: {
                lines: codeLines,
                functions,
                events,
                structs,
                mappings
            }
        };
    } catch (error) {
        console.error("❌ Error during analysis:", error.message);
        return null;
    }
}

// Run the analyzer
analyzeContractSize().catch(console.error);
