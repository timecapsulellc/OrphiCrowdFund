#!/bin/zsh
# Post-deployment commands for V4Ultra BSC Testnet

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}ORPHI CROWDFUND V4ULTRA DEPLOYMENT TOOLS${NC}"
echo -e "${BLUE}=========================================${NC}\n"

# Check if deployment addresses are set
if [ -z "$MOCKUSDT_ADDRESS" ] || [ -z "$V4ULTRA_ADDRESS" ] || [ -z "$ADMIN_ADDRESS" ]; then
    echo -e "${YELLOW}⚠️  Please set the deployment addresses first:${NC}"
    echo -e "export MOCKUSDT_ADDRESS=\"your_mockusdt_address\""
    echo -e "export V4ULTRA_ADDRESS=\"your_v4ultra_address\""
    echo -e "export ADMIN_ADDRESS=\"your_admin_address\""
    echo -e "\n${YELLOW}Then run this script again.${NC}"
    exit 1
fi

echo -e "${GREEN}Deployment Addresses:${NC}"
echo -e "MockUSDT: $MOCKUSDT_ADDRESS"
echo -e "V4Ultra: $V4ULTRA_ADDRESS"
echo -e "Admin: $ADMIN_ADDRESS\n"

# Update script files with actual addresses
echo -e "${BLUE}Updating scripts with deployment addresses...${NC}"
sed -i '' "s|YOUR_DEPLOYED_MOCKUSDT_ADDRESS|$MOCKUSDT_ADDRESS|g" standalone-v4ultra/verify-bsc-testnet.js
sed -i '' "s|YOUR_DEPLOYED_V4ULTRA_ADDRESS|$V4ULTRA_ADDRESS|g" standalone-v4ultra/verify-bsc-testnet.js
sed -i '' "s|YOUR_ADMIN_ADDRESS|$ADMIN_ADDRESS|g" standalone-v4ultra/verify-bsc-testnet.js

sed -i '' "s|YOUR_DEPLOYED_MOCKUSDT_ADDRESS|$MOCKUSDT_ADDRESS|g" standalone-v4ultra/test-bsc-testnet.js
sed -i '' "s|YOUR_DEPLOYED_V4ULTRA_ADDRESS|$V4ULTRA_ADDRESS|g" standalone-v4ultra/test-bsc-testnet.js

sed -i '' "s|YOUR_DEPLOYED_V4ULTRA_ADDRESS|$V4ULTRA_ADDRESS|g" standalone-v4ultra/setup-chainlink-automation.js

echo -e "${GREEN}✅ Scripts updated successfully!${NC}\n"

# Display available commands
echo -e "${BLUE}Available Commands:${NC}"
echo -e "${YELLOW}1. Verify Contracts on BSCScan:${NC}"
echo -e "   npx hardhat run standalone-v4ultra/verify-bsc-testnet.js --network bsc_testnet --config hardhat.standalone.config.js\n"

echo -e "${YELLOW}2. Run Post-Deployment Tests:${NC}"
echo -e "   npx hardhat run standalone-v4ultra/test-bsc-testnet.js --network bsc_testnet --config hardhat.standalone.config.js\n"

echo -e "${YELLOW}3. Set Up Chainlink Automation:${NC}"
echo -e "   npx hardhat run standalone-v4ultra/setup-chainlink-automation.js --network bsc_testnet --config hardhat.standalone.config.js\n"

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}IMPORTANT: BSC TESTNET CONTRACT INTERACTION GUIDE${NC}"
echo -e "${BLUE}==================================================${NC}"
echo -e "
1. ${YELLOW}BSCScan Interaction${NC}:
   - View contracts at: https://testnet.bscscan.com/address/$V4ULTRA_ADDRESS
   - After verification, you can use the 'Read Contract' and 'Write Contract' tabs

2. ${YELLOW}Test Token Distribution${NC}:
   - Mint MockUSDT to test accounts
   - Approve tokens for V4Ultra contract
   - Register users with different tiers
   - Add eligible users to ClubPool

3. ${YELLOW}Chainlink Setup${NC}:
   - Register with Chainlink Keepers: https://automation.chain.link
   - Fund with ~1-2 LINK tokens

4. ${YELLOW}Verification${NC}:
   - Once deployed, you can run the test suite above to verify all features
"

echo -e "${GREEN}Ready to proceed with post-deployment steps!${NC}"
