// ABIManager.jsx - Simple ABI provider for demo
import React, { createContext, useContext } from 'react';

const ABIContext = createContext();

export const ABIProvider = ({ children }) => {
  const abiData = {
    version: 'v4ultra',
    contracts: {
      OrphiCrowdFund: {
        abi: [], // Demo ABI
        features: ['Enhanced Security', 'Gas Optimization', 'V4 Ultra Features']
      }
    }
  };

  return (
    <ABIContext.Provider value={abiData}>
      {children}
    </ABIContext.Provider>
  );
};

export const useABI = () => {
  const context = useContext(ABIContext);
  if (!context) {
    throw new Error('useABI must be used within an ABIProvider');
  }
  return context;
};

export default { ABIProvider, useABI };
