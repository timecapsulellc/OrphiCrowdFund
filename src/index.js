import React from 'react';
import ReactDOM from 'react-dom';
import MatrixDashboard from './MatrixDashboard';

ReactDOM.render(
  <React.StrictMode>
    <MatrixDashboard 
      contractAddress="0xYourContractAddress" 
      provider={new ethers.providers.Web3Provider(window.ethereum)} 
      userAddress="0xYourUserAddress" 
      demoMode={true} 
    />
  </React.StrictMode>,
  document.getElementById('root')
);
