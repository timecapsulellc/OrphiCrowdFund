// ABIManager.jsx - Centralized ABI management system
import React, { createContext, useContext, useState, useEffect } from 'react';
import './OrphiChainEnhanced.css';

/**
 * OrphiChain ABI Manager
 * 
 * Centralized system for managing contract ABIs:
 * - Stores contract ABIs by name and version
 * - Handles automatic version detection and fallbacks
 * - Dynamically loads ABIs from IPFS or other sources
 * - Maintains cache for performance
 * - Provides context for easy access throughout the application
 * 
 * Usage example:
 * 
 * ```jsx
 * // Wrap your app or component with provider
 * <ABIProvider defaultVersion="v4">
 *   <YourApp />
 * </ABIProvider>
 * 
 * // In components
 * const { getABI, currentVersion } = useABI();
 * const crowdfundABI = getABI('OrphiCrowdFund');
 * ```
 */

// Core ABIs - Always available offline
const CORE_ABIS = {
  // Common ERC20 methods needed for USDT interaction
  ERC20: [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 amount)",
    "event Approval(address indexed owner, address indexed spender, uint256 amount)"
  ],
  
  // Minimal OrphiCrowdFund ABI that works across versions
  OrphiCrowdFundMinimal: [
    // User registration and information
    "function registerUser(address _sponsor, uint8 _packageTier) external",
    "function isRegistered(address _user) external view returns (bool)",
    "function getUserInfo(address _user) external view returns (uint32 id, address sponsor, uint16 directCount, uint16 packageTier, uint64 totalEarned, uint64 lastWithdrawal, uint64 withdrawable, uint16 leaderRank, uint16 kyc, uint32 clubPool)",
    
    // System statistics
    "function totalMembers() external view returns (uint256)",
    "function totalVolume() external view returns (uint256)",
    "function getPoolBalances() external view returns (uint256[5] memory)",
    
    // Transactions
    "function withdraw() external",
    
    // Events
    "event UserRegistered(address indexed user, address indexed sponsor, uint8 packageTier, uint256 userId)",
    "event WithdrawalMade(address indexed user, uint256 amount)",
    "event GlobalHelpDistributed(uint256 totalAmount, uint256 participantCount)"
  ],
  
  // V4Ultra specific functions
  OrphiCrowdFundV4Ultra: [
    // Enhanced user registration
    "function register(address sponsor, uint8 packageTier) external",
    
    // KYC related
    "function setKYCStatus(address user, bool status) external",
    "function isKYCVerified(address user) external view returns (bool)",
    
    // Club Pool
    "function createClubPool(uint256 duration) external",
    "function addToClubPool() external",
    "function claimClubPool() external",
    "function getClubPoolInfo(address user) external view returns (bool isActive, uint256 joinTime, uint256 lockTime, uint256 amount)",
    
    // Chainlink Automation
    "function enableAutomation(bool enabled) external",
    "function updateAutomationConfig(uint256 gasLimit, uint256 batchSize) external",
    "function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData)",
    "function performUpkeep(bytes calldata performData) external",
    
    // Enhanced views
    "function getSystemStatsEnhanced() external view returns (uint32 totalUsers, uint128 totalVolume, uint256 lastGHPTime, uint256 lastLeaderTime, uint256 dailyRegistrations, uint256 dailyWithdrawals)",
    "function getUserInfoEnhanced(address user) external view returns (bool isRegistered, uint32 id, address sponsor, uint16 directCount, uint16 packageTier, uint64 totalEarned, uint64 withdrawable, uint16 leaderRank, bool isKYCVerified, uint256 clubPoolAmount)"
  ],
  
  // V4UltraSecure specific functions
  OrphiCrowdFundV4UltraSecure: [
    // All V4Ultra functions +
    
    // Emergency controls
    "function emergencyLock() external",
    "function emergencyUnlock() external",
    "function withdrawLeftoverFunds() external",
    "function pause() external",
    "function unpause() external",
    
    // Security state
    "function state() external view returns (bool paused, bool systemLocked, uint256 lastDistribution, uint256 emergencyMode)",
    "function activateEmergencyMode(uint16 withdrawalFeePermille) external",
    "function emergencyWithdraw() external"
  ]
};

// Contract versions with their release data
const CONTRACT_VERSIONS = {
  // Legacy version
  v3: {
    released: '2023-08-01',
    contracts: ['OrphiCrowdFundV3', 'ERC20'],
    ipfsHash: 'QmOrphiCrowdFundV3ABIs', // Example IPFS hash
    features: [
      'Basic registration',
      'Matrix placement',
      'Simple distribution'
    ]
  },
  
  // Current main version
  v4: {
    released: '2023-11-15',
    contracts: ['OrphiCrowdFundV4', 'ERC20'],
    ipfsHash: 'QmOrphiCrowdFundV4ABIs', // Example IPFS hash
    features: [
      'Enhanced registration',
      'Automated distribution',
      'Leader bonuses',
      'Chainlink integration'
    ]
  },
  
  // Enhanced version
  v4Ultra: {
    released: '2024-03-01',
    contracts: ['OrphiCrowdFundV4Ultra', 'ERC20'],
    ipfsHash: 'QmOrphiCrowdFundV4UltraABIs', // Example IPFS hash
    features: [
      'KYC verification',
      'Club pools',
      'Enhanced security',
      'Advanced analytics'
    ]
  },
  
  // Secure version
  v4UltraSecure: {
    released: '2024-04-15',
    contracts: ['OrphiCrowdFundV4UltraSecure', 'ERC20'],
    ipfsHash: 'QmOrphiCrowdFundV4UltraSecureABIs', // Example IPFS hash
    features: [
      'Emergency controls',
      'Enhanced security',
      'Overflow protection',
      'MEV protection'
    ]
  }
};

// Create ABI Context
const ABIContext = createContext({
  getABI: () => [],
  currentVersion: 'v4',
  supportedVersions: Object.keys(CONTRACT_VERSIONS),
  setVersion: () => {},
  isLoading: false,
  contractFeatures: []
});

// ABI Provider Component
export const ABIProvider = ({ children, defaultVersion = 'v4', ipfsGateway = 'https://ipfs.io/ipfs/' }) => {
  const [currentVersion, setCurrentVersion] = useState(defaultVersion);
  const [abiCache, setAbiCache] = useState(CORE_ABIS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Get contract features for current version
  const contractFeatures = CONTRACT_VERSIONS[currentVersion]?.features || [];

  // Load ABIs from external source (IPFS)
  const loadExternalABIs = async (version) => {
    if (!CONTRACT_VERSIONS[version]?.ipfsHash) return;
    
    const ipfsHash = CONTRACT_VERSIONS[version].ipfsHash;
    setIsLoading(true);
    
    try {
      // Try to fetch from IPFS
      const response = await fetch(`${ipfsGateway}${ipfsHash}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load ABIs: ${response.statusText}`);
      }
      
      const externalABIs = await response.json();
      
      // Update cache with new ABIs
      setAbiCache(prev => ({
        ...prev,
        ...externalABIs
      }));
      
      setError(null);
    } catch (err) {
      console.error('Error loading external ABIs:', err);
      setError(err.message);
      
      // Continue with core ABIs as fallback
    } finally {
      setIsLoading(false);
    }
  };

  // Load ABIs when version changes
  useEffect(() => {
    loadExternalABIs(currentVersion);
  }, [currentVersion]);

  // Get ABI for contract by name
  const getABI = (contractName) => {
    // First try exact match
    if (abiCache[contractName]) {
      return abiCache[contractName];
    }
    
    // If version-specific name is requested (e.g., OrphiCrowdFundV4)
    if (contractName.includes('V4Ultra')) {
      return abiCache['OrphiCrowdFundV4Ultra'] || abiCache['OrphiCrowdFundMinimal'];
    }
    
    if (contractName.includes('V4')) {
      return abiCache['OrphiCrowdFundV4'] || abiCache['OrphiCrowdFundMinimal'];
    }
    
    if (contractName.includes('V3')) {
      return abiCache['OrphiCrowdFundV3'] || abiCache['OrphiCrowdFundMinimal'];
    }
    
    // For generic "OrphiCrowdFund" request, use version-specific or minimal
    if (contractName === 'OrphiCrowdFund') {
      return abiCache[`OrphiCrowdFund${currentVersion.charAt(0).toUpperCase() + currentVersion.slice(1)}`] || 
             abiCache['OrphiCrowdFundMinimal'];
    }
    
    // If not found, return empty array
    console.warn(`ABI for contract "${contractName}" not found, returning empty array`);
    return [];
  };

  // Utility: Load ABI from /docs/abi directory by contract name and version
  const fetchABI = async (contractName, version = '1.0.0') => {
    try {
      const fileName = `/docs/abi/${contractName}_v${version}.json`;
      const response = await fetch(fileName);
      if (!response.ok) throw new Error('ABI file not found');
      const abiJson = await response.json();
      return abiJson.abi;
    } catch (err) {
      console.warn(`Failed to load ABI for ${contractName} v${version}:`, err);
      return null;
    }
  };

  // Load ABI from /docs/abi if not in CORE_ABIS
  const loadVersionedABI = async (contractName, version) => {
    if (abiCache[contractName]) return; // Already loaded
    
    const abi = await fetchABI(contractName, version);
    if (abi) {
      setAbiCache(prev => ({
        ...prev,
        [contractName]: abi
      }));
    }
  };

  // Auto-detect contract version by examining deployed contract
  const detectContractVersion = async (provider, contractAddress) => {
    if (!provider || !contractAddress) return;
    
    setIsLoading(true);
    
    try {
      // Create a minimal contract instance
      const minimalABI = ["function version() view returns (string)"];
      const contract = new ethers.Contract(contractAddress, minimalABI, provider);
      
      // Try to call version() function
      try {
        const version = await contract.version();
        if (version.startsWith('v4UltraSecure')) {
          setCurrentVersion('v4UltraSecure');
        } else if (version.startsWith('v4Ultra')) {
          setCurrentVersion('v4Ultra');
        } else if (version.startsWith('v4')) {
          setCurrentVersion('v4');
        } else if (version.startsWith('v3')) {
          setCurrentVersion('v3');
        }
        return;
      } catch (e) {
        // No version function, try feature detection
      }
      
      // Feature detection
      const testABIs = {
        // V4UltraSecure specific function
        v4UltraSecure: ["function emergencyLock() external"],
        
        // V4Ultra specific function
        v4Ultra: ["function addToClubPool() external"],
        
        // V4 specific function
        v4: ["function getSystemStatsEnhanced() view returns (uint32, uint128, uint256, uint256, uint256, uint256)"],
        
        // V3 specific function
        v3: ["function registerUserV3(address, uint8, uint256, bytes) external"]
      };
      
      // Test each version in order of newest to oldest
      for (const [version, abi] of Object.entries(testABIs)) {
        const testContract = new ethers.Contract(contractAddress, abi, provider);
        try {
          // Just check if the function exists in the ABI
          const fragment = testContract.interface.getFunction(abi[0].split(' ')[1].split('(')[0]);
          if (fragment) {
            setCurrentVersion(version);
            return;
          }
        } catch (e) {
          // Function doesn't exist, try next version
        }
      }
      
      // If we get here, we couldn't detect the version
      console.warn('Could not auto-detect contract version, using default:', defaultVersion);
      setCurrentVersion(defaultVersion);
      
    } catch (err) {
      console.error('Error detecting contract version:', err);
      // Fall back to default version
      setCurrentVersion(defaultVersion);
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const value = {
    getABI,
    currentVersion,
    setVersion: setCurrentVersion,
    supportedVersions: Object.keys(CONTRACT_VERSIONS),
    isLoading,
    error,
    contractFeatures,
    detectContractVersion
  };

  return (
    <ABIContext.Provider value={value}>
      {error && <div className="abi-error">Error loading contract ABIs: {error}</div>}
      {children}
    </ABIContext.Provider>
  );
};

// Custom hook for using ABI context
export const useABI = () => {
  const context = useContext(ABIContext);
  if (!context) {
    throw new Error('useABI must be used within an ABIProvider');
  }
  return context;
};

// Component to display available ABIs and versions
const ABIManager = () => {
  const { 
    getABI, 
    currentVersion, 
    setVersion, 
    supportedVersions,
    isLoading,
    contractFeatures 
  } = useABI();
  
  const [selectedContract, setSelectedContract] = useState('OrphiCrowdFund');
  const [showABI, setShowABI] = useState(false);
  
  // Get list of all available contract names
  const availableContracts = Object.keys(CORE_ABIS);
  
  // Get ABI for selected contract
  const selectedABI = getABI(selectedContract);
  
  return (
    <div className="abi-manager">
      <div className="abi-manager-header">
        <h3>ABI Manager</h3>
        <div className="version-selector">
          <label htmlFor="version-select">Contract Version:</label>
          <select 
            id="version-select"
            value={currentVersion}
            onChange={(e) => setVersion(e.target.value)}
            disabled={isLoading}
          >
            {supportedVersions.map(version => (
              <option key={version} value={version}>
                {version} ({CONTRACT_VERSIONS[version].released})
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="contract-features">
        <h4>Version Features:</h4>
        <ul>
          {contractFeatures.map((feature, index) => (
            <li key={index}>{feature}</li>
          ))}
        </ul>
      </div>
      
      <div className="contract-selector">
        <label htmlFor="contract-select">Select Contract:</label>
        <select 
          id="contract-select"
          value={selectedContract}
          onChange={(e) => setSelectedContract(e.target.value)}
        >
          {availableContracts.map(contractName => (
            <option key={contractName} value={contractName}>
              {contractName}
            </option>
          ))}
        </select>
        
        <button 
          className="toggle-abi-button"
          onClick={() => setShowABI(!showABI)}
        >
          {showABI ? 'Hide ABI' : 'Show ABI'}
        </button>
      </div>
      
      {isLoading && <div className="loading-indicator">Loading ABIs...</div>}
      
      {showABI && (
        <div className="abi-display">
          <h4>{selectedContract} ABI:</h4>
          <pre className="abi-json">
            {JSON.stringify(selectedABI, null, 2)}
          </pre>
          <button 
            className="copy-button"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(selectedABI, null, 2));
              alert('ABI copied to clipboard!');
            }}
          >
            Copy ABI
          </button>
        </div>
      )}
    </div>
  );
};

export default ABIManager;
