// Web3 Integration for OrphiCrowdFund V4UltraSecure
import { CONTRACTS, ORPHI_ABI, USDT_ABI, PACKAGE_TIERS } from './contracts.js';

class OrphiWeb3 {
    constructor() {
        this.web3 = null;
        this.account = null;
        this.contract = null;
        this.usdtContract = null;
        this.network = 'BSC_TESTNET';
    }

    // Initialize Web3 connection
    async init() {
        if (typeof window.ethereum !== 'undefined') {
            this.web3 = new Web3(window.ethereum);
            
            // Setup contracts
            const config = CONTRACTS[this.network];
            this.contract = new this.web3.eth.Contract(
                ORPHI_ABI, 
                config.contracts.OrphiCrowdFundV4UltraSecure.address
            );
            this.usdtContract = new this.web3.eth.Contract(
                USDT_ABI, 
                config.contracts.MockUSDT.address
            );

            console.log('Web3 initialized successfully');
            console.log('Contract Address:', config.contracts.OrphiCrowdFundV4UltraSecure.address);
            console.log('USDT Address:', config.contracts.MockUSDT.address);
            
            return true;
        } else {
            console.error('MetaMask not found');
            return false;
        }
    }

    // Connect wallet
    async connectWallet() {
        try {
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
            this.account = accounts[0];
            
            // Switch to BSC Testnet if needed
            await this.switchToBSCTestnet();
            
            console.log('Wallet connected:', this.account);
            return this.account;
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            throw error;
        }
    }

    // Switch to BSC Testnet
    async switchToBSCTestnet() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x61' }], // BSC Testnet
            });
        } catch (switchError) {
            // Chain not added, let's add it
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x61',
                        chainName: 'BSC Testnet',
                        rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
                        nativeCurrency: {
                            name: 'BNB',
                            symbol: 'BNB',
                            decimals: 18
                        },
                        blockExplorerUrls: ['https://testnet.bscscan.com']
                    }]
                });
            }
        }
    }

    // Get user info from contract
    async getUserInfo(address = null) {
        const userAddress = address || this.account;
        if (!userAddress) throw new Error('No address provided');

        try {
            const userInfo = await this.contract.methods.getUserInfo(userAddress).call();
            return {
                id: userInfo.id,
                teamSize: userInfo.teamSize,
                directCount: userInfo.directCount,
                packageTier: userInfo.packageTier,
                totalEarnings: this.web3.utils.fromWei(userInfo.totalEarnings.toString(), 'mwei'), // 6 decimals
                withdrawable: this.web3.utils.fromWei(userInfo.withdrawable.toString(), 'mwei'),
                isCapped: userInfo.isCapped,
                isKYCVerified: userInfo.isKYCVerified,
                leaderRank: userInfo.leaderRank,
                suspensionLevel: userInfo.suspensionLevel
            };
        } catch (error) {
            console.error('Error getting user info:', error);
            throw error;
        }
    }

    // Get contract state
    async getContractState() {
        try {
            const state = await this.contract.methods.state().call();
            return {
                totalUsers: state.totalUsers,
                lastUserId: state.lastUserId,
                automationOn: state.automationOn,
                systemLocked: state.systemLocked,
                totalVolume: this.web3.utils.fromWei(state.totalVolume.toString(), 'mwei')
            };
        } catch (error) {
            console.error('Error getting contract state:', error);
            throw error;
        }
    }

    // Get USDT balance
    async getUSDTBalance(address = null) {
        const userAddress = address || this.account;
        if (!userAddress) throw new Error('No address provided');

        try {
            const balance = await this.usdtContract.methods.balanceOf(userAddress).call();
            return this.web3.utils.fromWei(balance.toString(), 'mwei'); // 6 decimals
        } catch (error) {
            console.error('Error getting USDT balance:', error);
            throw error;
        }
    }

    // Mint test USDT (for testnet only)
    async mintTestUSDT(amount) {
        if (!this.account) throw new Error('Wallet not connected');

        try {
            const amountWei = this.web3.utils.toWei(amount.toString(), 'mwei');
            const tx = await this.usdtContract.methods.mint(this.account, amountWei).send({
                from: this.account
            });
            console.log('USDT minted:', tx.transactionHash);
            return tx;
        } catch (error) {
            console.error('Error minting USDT:', error);
            throw error;
        }
    }

    // Approve USDT spending
    async approveUSDT(amount) {
        if (!this.account) throw new Error('Wallet not connected');

        try {
            const amountWei = this.web3.utils.toWei(amount.toString(), 'mwei');
            const contractAddress = CONTRACTS[this.network].contracts.OrphiCrowdFundV4UltraSecure.address;
            
            const tx = await this.usdtContract.methods.approve(contractAddress, amountWei).send({
                from: this.account
            });
            console.log('USDT approved:', tx.transactionHash);
            return tx;
        } catch (error) {
            console.error('Error approving USDT:', error);
            throw error;
        }
    }

    // Register user
    async register(sponsorAddress, packageTier) {
        if (!this.account) throw new Error('Wallet not connected');
        if (!PACKAGE_TIERS[packageTier]) throw new Error('Invalid package tier');

        try {
            // First approve USDT
            const packageAmount = PACKAGE_TIERS[packageTier].amount;
            await this.approveUSDT(packageAmount);

            // Then register
            const tx = await this.contract.methods.register(sponsorAddress, packageTier).send({
                from: this.account
            });
            console.log('User registered:', tx.transactionHash);
            return tx;
        } catch (error) {
            console.error('Error registering:', error);
            throw error;
        }
    }

    // Withdraw earnings
    async withdraw() {
        if (!this.account) throw new Error('Wallet not connected');

        try {
            const tx = await this.contract.methods.withdraw().send({
                from: this.account
            });
            console.log('Withdrawal successful:', tx.transactionHash);
            return tx;
        } catch (error) {
            console.error('Error withdrawing:', error);
            throw error;
        }
    }

    // Format address for display
    formatAddress(address) {
        if (!address) return '';
        return address.substring(0, 6) + '...' + address.substring(address.length - 4);
    }

    // Get BSCScan URL for transaction
    getTxUrl(txHash) {
        return `https://testnet.bscscan.com/tx/${txHash}`;
    }

    // Get BSCScan URL for address
    getAddressUrl(address) {
        return `https://testnet.bscscan.com/address/${address}`;
    }
}

// Export instance
export const orphiWeb3 = new OrphiWeb3();

// Auto-initialize when DOM loads
if (typeof window !== 'undefined') {
    window.addEventListener('load', async () => {
        await orphiWeb3.init();
    });
}
