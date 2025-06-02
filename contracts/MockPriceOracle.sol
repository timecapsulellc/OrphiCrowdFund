// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// Mock for PriceOracle testing
interface IPriceOracle {
    function getPrice(address token) external view returns (uint256);
    function isHealthy() external view returns (bool);
}

contract MockPriceOracle is IPriceOracle {
    uint256 public price;
    bool public healthy;

    constructor() {
        price = 1 * 10**18; // Default to $1.00
        healthy = true;
    }

    function getPrice(address /*token*/) external view override returns (uint256) {
        return price;
    }

    function isHealthy() external view override returns (bool) {
        return healthy;
    }

    function setPrice(uint256 _newPrice) external {
        price = _newPrice;
    }

    function setHealthy(bool _isHealthy) external {
        healthy = _isHealthy;
    }
}
