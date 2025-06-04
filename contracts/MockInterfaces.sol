// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// Minimal interfaces to avoid compilation errors
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData);
    function performUpkeep(bytes calldata performData) external;
}

// Mock SafeERC20 library
library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        token.transfer(to, value);
    }
    
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        token.transferFrom(from, to, value);
    }
}

// Mock OpenZeppelin contracts
contract Ownable {
    address private _owner;
    
    constructor(address initialOwner) {
        _owner = initialOwner;
    }
    
    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }
    
    function owner() public view returns (address) {
        return _owner;
    }
}

contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;
    
    constructor() {
        _status = _NOT_ENTERED;
    }
    
    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

contract Pausable {
    bool private _paused;
    
    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }
    
    function _pause() internal {
        _paused = true;
    }
    
    function _unpause() internal {
        _paused = false;
    }
}
