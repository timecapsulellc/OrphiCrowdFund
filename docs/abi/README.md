# OrphiChain ABI Files

This directory contains standardized, versioned ABI files for all OrphiChain contract versions.

- Each ABI is named as `ContractName_v<version>.json` (e.g., `OrphiCrowdFundV4UltraEnhanced_v1.0.0.json`).
- ABIs are exported from build artifacts and should match deployed contract versions.
- Update this directory whenever contracts are upgraded or redeployed.

## ABI Versioning
- Use semantic versioning: MAJOR.MINOR.PATCH (e.g., 1.0.0)
- Update the version in the filename and inside the JSON when the contract changes.

## Usage
- The frontend ABI manager (`ABIManager.jsx`) loads ABIs from this directory for all contract interactions.
- To add a new ABI, copy the ABI from the build artifact and paste it here, updating the version as needed.

---
