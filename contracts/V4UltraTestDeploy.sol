// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

import "./OrphiCrowdFundV4Ultra.sol";

// Contract to test V4Ultra compilation and size
contract V4UltraTestDeploy is OrphiCrowdFundV4Ultra {
    constructor(address _token, address _admin) 
        OrphiCrowdFundV4Ultra(_token, _admin) {
    }
}
