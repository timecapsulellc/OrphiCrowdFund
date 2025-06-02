// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDT
 * @dev Mock USDT token for testing purposes
 * Simulates the BEP20 USDT token on BSC
 */
contract MockUSDT is ERC20, Ownable {
    uint8 private _decimals;

    constructor() ERC20("Mock USDT", "USDT") Ownable(msg.sender) {
        _decimals = 18;
        // Mint initial supply for testing
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    // Function to give test tokens to users
    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
