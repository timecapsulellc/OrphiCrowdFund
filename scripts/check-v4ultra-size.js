// Script to check V4Ultra contract size
const fs = require("fs");
const solc = require("solc");
const path = require("path");

async function main() {
  console.log("Compiling OrphiCrowdFundV4Ultra to check size...");
  
  // Read the source code
  const sourcePath = path.join(__dirname, "../contracts/OrphiCrowdFundV4Ultra.sol");
  const source = fs.readFileSync(sourcePath, "utf8");
  
  // Configure solc input
  const input = {
    language: "Solidity",
    sources: {
      "OrphiCrowdFundV4Ultra.sol": {
        content: source
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        "*": {
          "*": ["*"]
        }
      }
    }
  };
  
  console.log("Finding imports...");
  
  // Find imports function for solc
  function findImports(importPath) {
    try {
      let fullPath;
      
      if (importPath.startsWith("@")) {
        // For node_modules imports
        fullPath = path.join(__dirname, "../node_modules", importPath);
      } else {
        // For local imports
        fullPath = path.join(__dirname, "../contracts", importPath);
      }
      
      console.log(`Trying to import: ${fullPath}`);
      return { contents: fs.readFileSync(fullPath, "utf8") };
    } catch (e) {
      console.error(`Error importing ${importPath}: ${e.message}`);
      return { error: `Error importing ${importPath}: ${e.message}` };
    }
  }
  
  try {
    // Compile the contract
    console.log("Compiling...");
    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    
    // Check if there were any errors
    if (output.errors) {
      output.errors.forEach(error => {
        console.log(error.formattedMessage);
      });
      
      // Stop if there are severe errors
      if (output.errors.some(error => error.severity === "error")) {
        console.error("Compilation failed with errors.");
        process.exit(1);
      }
    }
    
    // Get bytecode
    const bytecode = output.contracts["OrphiCrowdFundV4Ultra.sol"]["OrphiCrowdFundV4Ultra"].evm.bytecode.object;
    const bytecodeSize = bytecode.length / 2; // Convert hex to bytes
    
    console.log(`Contract bytecode size: ${bytecodeSize} bytes`);
    
    // Check if it fits within 24KB limit
    const sizeInKB = bytecodeSize / 1024;
    console.log(`Size in KB: ${sizeInKB.toFixed(2)} KB`);
    
    if (bytecodeSize <= 24 * 1024) {
      console.log("✅ SUCCESS: Contract size is within the 24KB limit!");
    } else {
      console.log(`❌ FAIL: Contract exceeds 24KB limit by ${(bytecodeSize - 24 * 1024)} bytes`);
    }
    
    // Write size report to file
    const report = `
# V4Ultra Contract Size Report
- **Date**: ${new Date().toISOString()}
- **Contract**: OrphiCrowdFundV4Ultra
- **Bytecode Size**: ${bytecodeSize} bytes (${sizeInKB.toFixed(2)} KB)
- **Status**: ${bytecodeSize <= 24 * 1024 ? '✅ Within 24KB limit' : '❌ Exceeds 24KB limit'}

## Optimization Settings
- Optimizer: Enabled
- Optimizer runs: 200
- Solidity version: 0.8.22
`;

    fs.writeFileSync(
      path.join(__dirname, "../V4Ultra_Size_Report.md"),
      report
    );
    
    console.log("Size report written to V4Ultra_Size_Report.md");
    
  } catch (error) {
    console.error("Compilation error:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
