// matrix-dashboard.js
// Comprehensive Matrix Dashboard for OrphiMatrix Contract
//
// DEPLOYMENT INSTRUCTIONS:
// 1. Update contractAddress with the deployed OrphiMatrix contract address
// 2. Update contractABI with the complete OrphiMatrix contract ABI
// 3. Ensure MetaMask or compatible wallet is available
// 4. Deploy on BSC testnet/mainnet as configured
//
// FEATURES:
// - Matrix visualization with vis-network
// - Real-time contract interaction
// - User lookup and details display
// - Admin controls for node management
// - Network exploration (upline/downline)
// - Registration status checking

class MatrixDashboard {
    constructor() {
        this.web3 = null;
        this.contract = null;
        this.currentAccount = null;
        this.network = nu        document.getElementById('lookupUserBtn').addEventListener('click', () => this.lookupUser());
        document.getElementById('userLookupAddress').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.lookupUser();
        });        this.isConnected = false;
        
        // Contract configuration - Update these with actual deployed contract details
        this.contractAddress = '0x1234567890123456789012345678901234567890'; // TODO: Replace with actual OrphiMatrix contract address
        this.contractABI = [
            // Contract ABI - replace with actual ABI
            {
                "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
                "name": "matrixNodes",
                "outputs": [
                    {"internalType": "address", "name": "user", "type": "address"},
                    {"internalType": "address", "name": "parent", "type": "address"},
                    {"internalType": "address", "name": "leftChild", "type": "address"},
                    {"internalType": "address", "name": "rightChild", "type": "address"},
                    {"internalType": "uint256", "name": "position", "type": "uint256"},
                    {"internalType": "uint256", "name": "teamSize", "type": "uint256"},
                    {"internalType": "uint256", "name": "level", "type": "uint256"},
                    {"internalType": "bool", "name": "isActive", "type": "bool"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
                "name": "isUserRegistered",
                "outputs": [{"internalType": "bool", "name": "registered", "type": "bool"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "user", "type": "address"},
                    {"internalType": "uint256", "name": "levels", "type": "uint256"}
                ],
                "name": "getUpline",
                "outputs": [{"internalType": "address[]", "name": "upline", "type": "address[]"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "user", "type": "address"},
                    {"internalType": "uint256", "name": "targetLevel", "type": "uint256"}
                ],
                "name": "getDownlineAtLevel",
                "outputs": [{"internalType": "address[]", "name": "downline", "type": "address[]"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "getMatrixStats",
                "outputs": [
                    {"internalType": "uint256", "name": "totalNodes_", "type": "uint256"},
                    {"internalType": "uint256", "name": "activeNodes", "type": "uint256"},
                    {"internalType": "uint256", "name": "maxLevel", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
                "name": "getTeamSize",
                "outputs": [{"internalType": "uint256", "name": "teamSize", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "user", "type": "address"},
                    {"internalType": "bool", "name": "active", "type": "bool"}
                ],
                "name": "setNodeActive",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
                    {"indexed": true, "internalType": "address", "name": "parent", "type": "address"},
                    {"indexed": false, "internalType": "uint256", "name": "position", "type": "uint256"},
                    {"indexed": false, "internalType": "bool", "name": "isLeftChild", "type": "bool"},
                    {"indexed": false, "internalType": "uint256", "name": "level", "type": "uint256"}
                ],
                "name": "MatrixPlacement",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
                    {"indexed": false, "internalType": "uint256", "name": "newTeamSize", "type": "uint256"}
                ],
                "name": "TeamSizeUpdate",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
                    {"indexed": false, "internalType": "uint256", "name": "position", "type": "uint256"}
                ],
                "name": "MatrixNodeActivated",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
                    {"indexed": false, "internalType": "uint256", "name": "position", "type": "uint256"}
                ],
                "name": "MatrixNodeDeactivated",
                "type": "event"
            }
        ];

        // Network visualization
        this.network = null;
        this.nodes = new vis.DataSet([]);
        this.edges = new vis.DataSet([]);
        
        this.init();
    }

    async init() {
        await this.initWeb3();
        this.setupEventListeners();
        this.setupNetworkVisualization();
        await this.loadInitialData();
    }

    async initWeb3() {
        try {
            if (typeof window.ethereum !== 'undefined') {
                this.web3 = new Web3(window.ethereum);
                await this.connectWallet();
            } else {
                this.showNotification('MetaMask not detected. Please install MetaMask.', 'error');
            }
        } catch (error) {
            console.error('Error initializing Web3:', error);
            this.showNotification('Failed to initialize Web3', 'error');
        }
    }

    async connectWallet() {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.currentAccount = accounts[0];
            this.isConnected = true;
            
            // Get network information
            const networkId = await this.web3.eth.net.getId();
            this.network = this.getNetworkName(networkId);
            
            // Initialize contract
            this.contract = new this.web3.eth.Contract(this.contractABI, this.contractAddress);
            
            this.updateConnectionStatus();
            this.showNotification('Wallet connected successfully!', 'success');
            
            // Listen for account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.currentAccount = accounts[0];
                    this.updateConnectionStatus();
                    this.loadUserData();
                }
            });
            
            // Listen for network changes
            window.ethereum.on('chainChanged', (chainId) => {
                window.location.reload();
            });
            
        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showNotification('Failed to connect wallet', 'error');
        }
    }

    disconnect() {
        this.currentAccount = null;
        this.isConnected = false;
        this.contract = null;
        this.updateConnectionStatus();
        this.clearUserData();
        this.showNotification('Wallet disconnected', 'info');
    }

    getNetworkName(networkId) {
        const networks = {
            1: 'Ethereum Mainnet',
            5: 'Goerli Testnet',
            11155111: 'Sepolia Testnet',
            137: 'Polygon Mainnet',
            80001: 'Mumbai Testnet'
        };
        return networks[networkId] || `Network ${networkId}`;
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        const accountElement = document.getElementById('currentAccount');
        const networkElement = document.getElementById('currentNetwork');
        const connectButton = document.getElementById('connectWallet');
        const disconnectButton = document.getElementById('disconnectWallet');

        if (this.isConnected) {
            statusElement.textContent = 'Connected';
            statusElement.className = 'status-connected';
            accountElement.textContent = this.formatAddress(this.currentAccount);
            networkElement.textContent = this.network;
            connectButton.style.display = 'none';
            disconnectButton.style.display = 'inline-block';
        } else {
            statusElement.textContent = 'Disconnected';
            statusElement.className = 'status-disconnected';
            accountElement.textContent = 'Not connected';
            networkElement.textContent = 'Unknown';
            connectButton.style.display = 'inline-block';
            disconnectButton.style.display = 'none';
        }
    }

    setupEventListeners() {
        // Wallet connection
        document.getElementById('connectWallet').addEventListener('click', () => this.connectWallet());
        document.getElementById('disconnectWallet').addEventListener('click', () => this.disconnect());

        // User lookup
        document.getElementById('lookupUser').addEventListener('click', () => this.lookupUser());
        document.getElementById('userLookupAddress').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.lookupUser();
        });

        // Admin controls
        document.getElementById('activateNode').addEventListener('click', () => this.activateNode());
        document.getElementById('deactivateNode').addEventListener('click', () => this.deactivateNode());

        // Network exploration
        document.getElementById('loadUpline').addEventListener('click', () => this.loadUpline());
        document.getElementById('loadDownline').addEventListener('click', () => this.loadDownline());

        // Registration check
        document.getElementById('checkRegistration').addEventListener('click', () => this.checkRegistration());
        document.getElementById('checkAddress').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkRegistration();
        });

        // Matrix controls
        document.getElementById('refreshMatrix').addEventListener('click', () => this.refreshMatrix());
        document.getElementById('centerMatrix').addEventListener('click', () => this.centerMatrix());
    }

    setupNetworkVisualization() {
        const container = document.getElementById('matrixVisualization');
        const data = {
            nodes: this.nodes,
            edges: this.edges
        };

        const options = {
            nodes: {
                shape: 'dot',
                size: 20,
                font: {
                    size: 12,
                    color: '#333'
                },
                borderWidth: 2,
                shadow: true
            },
            edges: {
                width: 2,
                color: { inherit: 'from' },
                smooth: {
                    type: 'cubicBezier',
                    forceDirection: 'vertical',
                    roundness: 0.4
                },
                arrows: {
                    to: { enabled: true, scaleFactor: 1 }
                }
            },
            layout: {
                hierarchical: {
                    direction: 'UD',
                    sortMethod: 'directed',
                    levelSeparation: 100,
                    nodeSpacing: 150
                }
            },
            physics: {
                hierarchicalRepulsion: {
                    centralGravity: 0.3,
                    springLength: 100,
                    springConstant: 0.01,
                    nodeDistance: 120,
                    damping: 0.09
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 200
            }
        };

        this.network = new vis.Network(container, data, options);

        // Handle node selection
        this.network.on('selectNode', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.selectNode(nodeId);
            }
        });

        // Handle double-click for centering
        this.network.on('doubleClick', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.loadUserData(nodeId);
            }
        });
    }

    async loadInitialData() {
        if (!this.isConnected) return;

        try {
            await this.loadMatrixStats();
            if (this.currentAccount) {
                await this.loadUserData();
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Failed to load initial data', 'error');
        }
    }

    async loadMatrixStats() {
        try {
            const stats = await this.contract.methods.getMatrixStats().call();
            
            document.getElementById('totalNodes').textContent = stats.totalNodes_;
            document.getElementById('activeNodes').textContent = stats.activeNodes;
            document.getElementById('maxLevel').textContent = stats.maxLevel;
            
            // Calculate activity rate
            const activityRate = stats.totalNodes_ > 0 ? 
                (stats.activeNodes / stats.totalNodes_ * 100).toFixed(1) : 0;
            document.getElementById('activityRate').textContent = `${activityRate}%`;
            
        } catch (error) {
            console.error('Error loading matrix stats:', error);
            this.showNotification('Failed to load matrix statistics', 'error');
        }
    }

    async loadUserData(userAddress = this.currentAccount) {
        if (!userAddress || !this.contract) return;

        try {
            const nodeData = await this.contract.methods.matrixNodes(userAddress).call();
            const isRegistered = await this.contract.methods.isUserRegistered(userAddress).call();
            const teamSize = await this.contract.methods.getTeamSize(userAddress).call();

            this.displayUserDetails(userAddress, nodeData, isRegistered, teamSize);
            
            if (isRegistered) {
                await this.buildMatrixVisualization(userAddress);
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showNotification('Failed to load user data', 'error');
        }
    }

    displayUserDetails(address, nodeData, isRegistered, teamSize) {
        document.getElementById('userDetailsAddress').textContent = this.formatAddress(address);
        document.getElementById('userDetailsRegistered').innerHTML = isRegistered ? 
            '<span class="status-active">Registered</span>' : 
            '<span class="status-inactive">Not Registered</span>';

        if (isRegistered) {
            document.getElementById('userDetailsParent').textContent = 
                nodeData.parent !== '0x0000000000000000000000000000000000000000' ? 
                this.formatAddress(nodeData.parent) : 'Root';
            document.getElementById('userDetailsLeftChild').textContent = 
                nodeData.leftChild !== '0x0000000000000000000000000000000000000000' ? 
                this.formatAddress(nodeData.leftChild) : 'None';
            document.getElementById('userDetailsRightChild').textContent = 
                nodeData.rightChild !== '0x0000000000000000000000000000000000000000' ? 
                this.formatAddress(nodeData.rightChild) : 'None';
            document.getElementById('userDetailsPosition').textContent = nodeData.position;
            document.getElementById('userDetailsLevel').textContent = nodeData.level;
            document.getElementById('userDetailsTeamSize').textContent = teamSize;
            document.getElementById('userDetailsStatus').innerHTML = nodeData.isActive ? 
                '<span class="status-active">Active</span>' : 
                '<span class="status-inactive">Inactive</span>';
        } else {
            // Clear details for unregistered users
            ['userDetailsParent', 'userDetailsLeftChild', 'userDetailsRightChild', 
             'userDetailsPosition', 'userDetailsLevel', 'userDetailsTeamSize', 'userDetailsStatus']
            .forEach(id => document.getElementById(id).textContent = 'N/A');
        }
    }

    async buildMatrixVisualization(centerUser) {
        try {
            this.nodes.clear();
            this.edges.clear();

            // Get center user data
            const centerNode = await this.contract.methods.matrixNodes(centerUser).call();
            
            // Add center node
            this.nodes.add({
                id: centerUser,
                label: this.formatAddress(centerUser),
                color: centerUser === this.currentAccount ? '#4299e1' : '#48bb78',
                title: `Position: ${centerNode.position}\nLevel: ${centerNode.level}\nTeam Size: ${centerNode.teamSize}`
            });

            // Build tree structure
            await this.addNodeToVisualization(centerUser, centerNode);
            
            // Get upline
            const upline = await this.contract.methods.getUpline(centerUser, 5).call();
            for (const parentAddr of upline) {
                if (parentAddr !== '0x0000000000000000000000000000000000000000') {
                    await this.addNodeToVisualization(parentAddr);
                }
            }
            
            // Get downline levels
            for (let level = 1; level <= 3; level++) {
                try {
                    const downline = await this.contract.methods.getDownlineAtLevel(centerUser, level).call();
                    for (const childAddr of downline) {
                        if (childAddr !== '0x0000000000000000000000000000000000000000') {
                            await this.addNodeToVisualization(childAddr);
                        }
                    }
                } catch (error) {
                    console.log(`No downline at level ${level}`);
                }
            }
            
            // Center the network
            this.network.fit();
            
        } catch (error) {
            console.error('Error building matrix visualization:', error);
            this.showNotification('Failed to build matrix visualization', 'error');
        }
    }

    async addNodeToVisualization(userAddress, nodeData = null) {
        try {
            if (!nodeData) {
                nodeData = await this.contract.methods.matrixNodes(userAddress).call();
            }

            const teamSize = await this.contract.methods.getTeamSize(userAddress).call();
            
            // Add node if not exists
            if (!this.nodes.get(userAddress)) {
                this.nodes.add({
                    id: userAddress,
                    label: this.formatAddress(userAddress),
                    color: nodeData.isActive ? '#48bb78' : '#e53e3e',
                    title: `Address: ${userAddress}\nPosition: ${nodeData.position}\nLevel: ${nodeData.level}\nTeam Size: ${teamSize}\nStatus: ${nodeData.isActive ? 'Active' : 'Inactive'}`
                });
            }

            // Add edges to parent
            if (nodeData.parent && nodeData.parent !== '0x0000000000000000000000000000000000000000') {
                this.edges.add({
                    from: nodeData.parent,
                    to: userAddress,
                    label: nodeData.leftChild === userAddress ? 'L' : 'R'
                });
            }
            
        } catch (error) {
            console.error('Error adding node to visualization:', error);
        }
    }

    async lookupUser() {
        const address = document.getElementById('userLookupAddress').value.trim();
        if (!this.isValidAddress(address)) {
            this.showNotification('Please enter a valid Ethereum address', 'error');
            return;
        }

        await this.loadUserData(address);
    }

    async loadUpline() {
        const userAddress = document.getElementById('userAddress').value.trim() || this.currentAccount;
        const levels = parseInt(document.getElementById('uplineLevels').value);
        
        if (!this.isValidAddress(userAddress)) {
            this.showNotification('Please enter a valid address', 'error');
            return;
        }

        try {
            const upline = await this.contract.methods.getUpline(userAddress, levels).call();
            this.displayUpline(upline);
        } catch (error) {
            console.error('Error loading upline:', error);
            this.showNotification('Failed to load upline', 'error');
        }
    }

    displayUpline(upline) {
        const container = document.getElementById('uplineList');
        container.innerHTML = '';

        if (upline.length === 0) {
            container.innerHTML = '<p>No upline found</p>';
            return;
        }

        upline.forEach((address, index) => {
            if (address !== '0x0000000000000000000000000000000000000000') {
                const div = document.createElement('div');
                div.className = 'upline-item';
                div.innerHTML = `
                    <span class="level-badge">L${index + 1}</span>
                    <span class="address">${this.formatAddress(address)}</span>
                    <button onclick="dashboard.loadUserData('${address}')" class="btn-small">View</button>
                `;
                container.appendChild(div);
            }
        });
    }

    async loadDownline() {
        const userAddress = document.getElementById('userAddress').value.trim() || this.currentAccount;
        const level = parseInt(document.getElementById('downlineLevel').value);
        
        if (!this.isValidAddress(userAddress)) {
            this.showNotification('Please enter a valid address', 'error');
            return;
        }

        try {
            const downline = await this.contract.methods.getDownlineAtLevel(userAddress, level).call();
            this.displayDownline(downline, level);
        } catch (error) {
            console.error('Error loading downline:', error);
            this.showNotification('Failed to load downline', 'error');
        }
    }

    displayDownline(downline, level) {
        const container = document.getElementById('downlineList');
        container.innerHTML = '';

        if (downline.length === 0) {
            container.innerHTML = `<p>No downline found at level ${level}</p>`;
            return;
        }

        const header = document.createElement('h5');
        header.textContent = `Level ${level} (${downline.length} members)`;
        container.appendChild(header);

        downline.forEach((address) => {
            if (address !== '0x0000000000000000000000000000000000000000') {
                const div = document.createElement('div');
                div.className = 'downline-item';
                div.innerHTML = `
                    <span class="address">${this.formatAddress(address)}</span>
                    <button onclick="dashboard.loadUserData('${address}')" class="btn-small">View</button>
                `;
                container.appendChild(div);
            }
        });
    }

    async checkRegistration() {
        const address = document.getElementById('checkAddress').value.trim();
        if (!this.isValidAddress(address)) {
            this.showNotification('Please enter a valid Ethereum address', 'error');
            return;
        }

        try {
            const isRegistered = await this.contract.methods.isUserRegistered(address).call();
            const resultContainer = document.getElementById('registrationResult');
            
            if (isRegistered) {
                const nodeData = await this.contract.methods.matrixNodes(address).call();
                const teamSize = await this.contract.methods.getTeamSize(address).call();
                
                resultContainer.innerHTML = `
                    <div class="registration-result success">
                        <h5><i class="fas fa-check-circle"></i> Registered</h5>
                        <p><strong>Position:</strong> ${nodeData.position}</p>
                        <p><strong>Level:</strong> ${nodeData.level}</p>
                        <p><strong>Team Size:</strong> ${teamSize}</p>
                        <p><strong>Status:</strong> ${nodeData.isActive ? 'Active' : 'Inactive'}</p>
                        <button onclick="dashboard.loadUserData('${address}')" class="btn">View Details</button>
                    </div>
                `;
            } else {
                resultContainer.innerHTML = `
                    <div class="registration-result error">
                        <h5><i class="fas fa-times-circle"></i> Not Registered</h5>
                        <p>This address is not registered in the matrix.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error checking registration:', error);
            this.showNotification('Failed to check registration status', 'error');
        }
    }

    async activateNode() {
        const address = document.getElementById('adminAddress').value.trim();
        if (!this.isValidAddress(address)) {
            this.showNotification('Please enter a valid address', 'error');
            return;
        }

        try {
            await this.contract.methods.setNodeActive(address, true).send({
                from: this.currentAccount
            });
            this.showNotification('Node activated successfully!', 'success');
            await this.loadUserData(address);
        } catch (error) {
            console.error('Error activating node:', error);
            this.showNotification('Failed to activate node', 'error');
        }
    }

    async deactivateNode() {
        const address = document.getElementById('adminAddress').value.trim();
        if (!this.isValidAddress(address)) {
            this.showNotification('Please enter a valid address', 'error');
            return;
        }

        try {
            await this.contract.methods.setNodeActive(address, false).send({
                from: this.currentAccount
            });
            this.showNotification('Node deactivated successfully!', 'success');
            await this.loadUserData(address);
        } catch (error) {
            console.error('Error deactivating node:', error);
            this.showNotification('Failed to deactivate node', 'error');
        }
    }

    async refreshMatrix() {
        const userAddress = document.getElementById('userAddress').value.trim() || this.currentAccount;
        if (userAddress) {
            await this.buildMatrixVisualization(userAddress);
            this.showNotification('Matrix refreshed!', 'success');
        }
    }

    centerMatrix() {
        if (this.network) {
            this.network.fit();
            this.showNotification('Matrix centered!', 'info');
        }
    }

    selectNode(nodeId) {
        // Load data for selected node
        this.loadUserData(nodeId);
        document.getElementById('userAddress').value = nodeId;
    }

    setupEventListeners_ContractEvents() {
        if (!this.contract) return;

        // Listen for MatrixPlacement events
        this.contract.events.MatrixPlacement({
            fromBlock: 'latest'
        }).on('data', (event) => {
            const { user, parent, position, isLeftChild, level } = event.returnValues;
            this.showNotification(
                `New placement: ${this.formatAddress(user)} under ${this.formatAddress(parent)}`,
                'info'
            );
            this.refreshMatrix();
        });

        // Listen for TeamSizeUpdate events
        this.contract.events.TeamSizeUpdate({
            fromBlock: 'latest'
        }).on('data', (event) => {
            const { user, newTeamSize } = event.returnValues;
            this.showNotification(
                `Team size updated: ${this.formatAddress(user)} - ${newTeamSize}`,
                'info'
            );
        });

        // Listen for MatrixNodeActivated events
        this.contract.events.MatrixNodeActivated({
            fromBlock: 'latest'
        }).on('data', (event) => {
            const { user, position } = event.returnValues;
            this.showNotification(
                `Node activated: ${this.formatAddress(user)}`,
                'success'
            );
            this.refreshMatrix();
        });

        // Listen for MatrixNodeDeactivated events
        this.contract.events.MatrixNodeDeactivated({
            fromBlock: 'latest'
        }).on('data', (event) => {
            const { user, position } = event.returnValues;
            this.showNotification(
                `Node deactivated: ${this.formatAddress(user)}`,
                'warning'
            );
            this.refreshMatrix();
        });
    }

    // Utility functions
    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    formatAddress(address) {
        if (!address || address === '0x0000000000000000000000000000000000000000') {
            return 'N/A';
        }
        return `${address.substring(0, 6)}...${address.substring(38)}`;
    }

    clearUserData() {
        // Clear user details
        ['userDetailsAddress', 'userDetailsRegistered', 'userDetailsParent', 
         'userDetailsLeftChild', 'userDetailsRightChild', 'userDetailsPosition', 
         'userDetailsLevel', 'userDetailsTeamSize', 'userDetailsStatus']
        .forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '';
        });

        // Clear visualization
        this.nodes.clear();
        this.edges.clear();

        // Clear lists
        document.getElementById('uplineList').innerHTML = '';
        document.getElementById('downlineList').innerHTML = '';
        document.getElementById('registrationResult').innerHTML = '';
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        }[type];

        notification.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
            <button class="close-notification" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new MatrixDashboard();
});

// Export for use in other scripts
window.MatrixDashboard = MatrixDashboard;
