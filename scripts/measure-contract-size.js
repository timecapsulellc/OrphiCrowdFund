const fs = require('fs');
const path = require('path');

// Configuration
const CONTRACT_NAME = 'OrphiCrowdFundV4Ultra';
const SIZE_LIMIT = 24 * 1024; // 24KB in bytes

// Path to artifacts
const artifactsPath = path.join(__dirname, '../artifacts/contracts');

async function main() {
  console.log(`Checking contract size for ${CONTRACT_NAME}...`);
  
  try {
    // Find the artifact file
    const contractDir = path.join(artifactsPath, `${CONTRACT_NAME}.sol`);
    const artifactPath = path.join(contractDir, `${CONTRACT_NAME}.json`);
    
    if (!fs.existsSync(artifactPath)) {
      console.error(`Contract artifact not found at ${artifactPath}`);
      console.error('Make sure the contract is compiled first with: npx hardhat compile');
      process.exit(1);
    }
    
    // Read and parse the artifact
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    // Get the deployed bytecode
    const bytecode = artifact.deployedBytecode;
    if (!bytecode) {
      console.error('Deployed bytecode not found in artifact');
      process.exit(1);
    }
    
    // Calculate size in bytes (removing '0x' prefix and dividing by 2 as each byte is 2 hex chars)
    const sizeInBytes = (bytecode.length - 2) / 2;
    const sizeInKB = sizeInBytes / 1024;
    
    console.log(`Contract size: ${sizeInBytes} bytes (${sizeInKB.toFixed(2)} KB)`);
    
    // Check if it's within limit
    if (sizeInBytes <= SIZE_LIMIT) {
      console.log(`✅ SUCCESS: Contract size is within the ${SIZE_LIMIT/1024}KB limit!`);
    } else {
      const overBy = sizeInBytes - SIZE_LIMIT;
      console.log(`❌ FAIL: Contract exceeds ${SIZE_LIMIT/1024}KB limit by ${overBy} bytes (${(overBy/1024).toFixed(2)} KB)`);
    }
    
    // Write report to file
    const reportPath = path.join(__dirname, '../V4Ultra_Size_Report.md');
    const report = `
# V4Ultra Contract Size Report
- **Date**: ${new Date().toISOString()}
- **Contract**: ${CONTRACT_NAME}
- **Bytecode Size**: ${sizeInBytes} bytes (${sizeInKB.toFixed(2)} KB)
- **Size Limit**: ${SIZE_LIMIT} bytes (${SIZE_LIMIT/1024} KB)
- **Status**: ${sizeInBytes <= SIZE_LIMIT ? '✅ Within limit' : '❌ Exceeds limit by ' + (sizeInBytes - SIZE_LIMIT) + ' bytes'}

## Next Steps
${sizeInBytes <= SIZE_LIMIT ? 
  '- Proceed with Chainlink automation integration\n- Implement automated testing for all features' : 
  '- Further optimization required\n- Consider splitting logic into libraries\n- Remove any unused functions or variables'}
`;
    
    fs.writeFileSync(reportPath, report);
    console.log(`Size report written to ${reportPath}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
