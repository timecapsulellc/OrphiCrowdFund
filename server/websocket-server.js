// WebSocket Backend Server for Real-time Contract Events
const WebSocket = require('ws');
const { ethers } = require('ethers');
const express = require('express');
const cors = require('cors');
const path = require('path');

class OrphiWebSocketServer {
    constructor(config = {}) {
        this.config = {
            port: config.port || 8080,
            httpPort: config.httpPort || 3001,
            rpcUrl: config.rpcUrl || 'http://localhost:8545',
            contractAddress: config.contractAddress || process.env.ENHANCED_V4ULTRA_ADDRESS,
            contractABI: config.contractABI || this.getContractABI(),
            reconnectInterval: config.reconnectInterval || 5000,
            maxReconnectAttempts: config.maxReconnectAttempts || 10,
            ...config
        };

        this.wss = null;
        this.httpServer = null;
        this.provider = null;
        this.contract = null;
        this.clients = new Set();
        this.reconnectAttempts = 0;
        this.systemHealth = {
            contractConnected: false,
            clientsConnected: 0,
            lastEventTime: null,
            totalEvents: 0,
            errors: []
        };

        console.log('🚀 OrphiWebSocketServer initializing...');
        console.log(`Contract Address: ${this.config.contractAddress}`);
        console.log(`RPC URL: ${this.config.rpcUrl}`);
    }

    // Enhanced Contract ABI for V4UltraEnhanced
    getContractABI() {
        return [
            // Real-time event
            "event RealTimeEvent(string indexed eventType, address indexed user, bytes eventData)",
            
            // User events
            "event UserRegistered(uint32 indexed userId, address indexed userAddress, address indexed sponsor, uint16 packageTier, uint256 amount)",
            "event WithdrawalMade(address indexed user, uint256 amount, uint256 timestamp)",
            
            // Distribution events
            "event GlobalHelpDistributed(uint256 totalAmount, uint256 usersCount, uint256 timestamp)",
            "event LeaderBonusDistributed(uint256 totalAmount, uint256 leadersCount, uint256 timestamp)",
            
            // Automation events
            "event AutomationExecuted(uint8 taskType, uint256 amount, bool success)",
            "event AutomationFailed(uint8 taskType, string reason, uint256 timestamp)",
            
            // Circuit breaker events
            "event CircuitBreakerTriggered(uint256 consecutiveFailures, uint256 timestamp)",
            "event CircuitBreakerReset(address indexed admin, uint256 timestamp)",
            
            // System health events
            "event SystemHealthUpdate(uint256 performanceScore, uint256 totalGasUsed, uint256 usersProcessed)",
            
            // Emergency events
            "event EmergencyModeActivated(address indexed admin, uint256 timestamp)",
            "event EmergencyModeDeactivated(address indexed admin, uint256 timestamp)",
            
            // View functions
            "function getSystemHealth() external view returns (tuple(uint256 performanceScore, uint256 totalGasUsed, uint256 lastHealthCheck, uint256 usersProcessed))",
            "function getCircuitBreakerState() external view returns (tuple(bool isOpen, uint256 consecutiveFailures, uint256 lastFailureTime))",
            "function getPoolBalances() external view returns (uint256[5] memory)",
            "function totalUsers() external view returns (uint256)",
            "function getUserInfo(address user) external view returns (tuple(uint32 id, address sponsor, uint256 totalEarned, uint16 packageTier, uint256 registrationTime, bool isActive, uint256 withdrawableAmount, uint256 totalInvested, uint256 directReferrals, uint256 matrixPosition))"
        ];
    }

    async start() {
        try {
            console.log('🔌 Connecting to blockchain...');
            await this.connectToBlockchain();
            
            console.log('🌐 Starting HTTP server...');
            await this.startHttpServer();
            
            console.log('📡 Starting WebSocket server...');
            await this.startWebSocketServer();
            
            console.log('🎧 Setting up event listeners...');
            await this.setupEventListeners();
            
            console.log('✅ OrphiWebSocketServer started successfully!');
            console.log(`WebSocket Server: ws://localhost:${this.config.port}`);
            console.log(`HTTP Server: http://localhost:${this.config.httpPort}`);
            
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            throw error;
        }
    }

    async connectToBlockchain() {
        try {
            this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
            
            // Test connection
            const network = await this.provider.getNetwork();
            console.log(`✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
            
            if (this.config.contractAddress) {
                this.contract = new ethers.Contract(
                    this.config.contractAddress,
                    this.config.contractABI,
                    this.provider
                );
                
                // Test contract connection
                const totalUsers = await this.contract.totalUsers();
                console.log(`✅ Contract connected, total users: ${totalUsers}`);
                
                this.systemHealth.contractConnected = true;
            } else {
                console.log('⚠️  No contract address provided, running in demo mode');
            }
            
            this.reconnectAttempts = 0;
            
        } catch (error) {
            console.error('❌ Blockchain connection failed:', error);
            this.systemHealth.contractConnected = false;
            
            if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`🔄 Reconnecting in ${this.config.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
                setTimeout(() => this.connectToBlockchain(), this.config.reconnectInterval);
            } else {
                throw new Error('Max reconnection attempts reached');
            }
        }
    }

    async startHttpServer() {
        const app = express();
        
        // Middleware
        app.use(cors());
        app.use(express.json());
        app.use(express.static(path.join(__dirname, '../docs')));
        
        // Health check endpoint
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                systemHealth: this.systemHealth,
                clients: this.clients.size,
                uptime: process.uptime()
            });
        });
        
        // System stats endpoint
        app.get('/api/system-stats', async (req, res) => {
            try {
                if (!this.contract) {
                    return res.json({ error: 'Contract not connected' });
                }
                
                const [systemHealth, circuitBreakerState, poolBalances, totalUsers] = await Promise.all([
                    this.contract.getSystemHealth(),
                    this.contract.getCircuitBreakerState(),
                    this.contract.getPoolBalances(),
                    this.contract.totalUsers()
                ]);
                
                res.json({
                    systemHealth: {
                        performanceScore: systemHealth.performanceScore.toString(),
                        totalGasUsed: systemHealth.totalGasUsed.toString(),
                        lastHealthCheck: systemHealth.lastHealthCheck.toString(),
                        usersProcessed: systemHealth.usersProcessed.toString()
                    },
                    circuitBreaker: {
                        isOpen: circuitBreakerState.isOpen,
                        consecutiveFailures: circuitBreakerState.consecutiveFailures.toString(),
                        lastFailureTime: circuitBreakerState.lastFailureTime.toString()
                    },
                    poolBalances: poolBalances.map(balance => balance.toString()),
                    totalUsers: totalUsers.toString(),
                    timestamp: Date.now()
                });
                
            } catch (error) {
                console.error('Error fetching system stats:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // User info endpoint
        app.get('/api/user/:address', async (req, res) => {
            try {
                if (!this.contract) {
                    return res.json({ error: 'Contract not connected' });
                }
                
                const userInfo = await this.contract.getUserInfo(req.params.address);
                
                res.json({
                    id: userInfo.id.toString(),
                    sponsor: userInfo.sponsor,
                    totalEarned: userInfo.totalEarned.toString(),
                    packageTier: userInfo.packageTier.toString(),
                    registrationTime: userInfo.registrationTime.toString(),
                    isActive: userInfo.isActive,
                    withdrawableAmount: userInfo.withdrawableAmount.toString(),
                    totalInvested: userInfo.totalInvested.toString(),
                    directReferrals: userInfo.directReferrals.toString(),
                    matrixPosition: userInfo.matrixPosition.toString()
                });
                
            } catch (error) {
                console.error('Error fetching user info:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Serve the real-time dashboard
        app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, '../docs/components/RealTimeWebSocketDashboard.jsx'));
        });
        
        return new Promise((resolve) => {
            this.httpServer = app.listen(this.config.httpPort, () => {
                console.log(`✅ HTTP server listening on port ${this.config.httpPort}`);
                resolve();
            });
        });
    }

    async startWebSocketServer() {
        this.wss = new WebSocket.Server({ 
            port: this.config.port,
            perMessageDeflate: false // Disable compression for better performance
        });
        
        this.wss.on('connection', (ws, request) => {
            console.log(`📱 New client connected from ${request.socket.remoteAddress}`);
            
            this.clients.add(ws);
            this.systemHealth.clientsConnected = this.clients.size;
            
            // Send welcome message with current system state
            this.sendToClient(ws, {
                type: 'connection_established',
                data: {
                    message: 'Connected to Orphi V4Ultra WebSocket',
                    systemHealth: this.systemHealth,
                    timestamp: Date.now()
                }
            });
            
            // Send current system stats
            this.sendSystemStats(ws);
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(ws, data);
                } catch (error) {
                    console.error('Invalid message from client:', error);
                }
            });
            
            ws.on('close', () => {
                console.log('📱 Client disconnected');
                this.clients.delete(ws);
                this.systemHealth.clientsConnected = this.clients.size;
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
                this.systemHealth.clientsConnected = this.clients.size;
            });
        });
        
        console.log(`✅ WebSocket server listening on port ${this.config.port}`);
    }

    handleClientMessage(ws, message) {
        switch (message.type) {
            case 'ping':
                this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
                break;
                
            case 'subscribe':
                // Handle subscription to specific event types
                ws.subscriptions = message.events || ['all'];
                this.sendToClient(ws, { 
                    type: 'subscription_confirmed', 
                    data: { events: ws.subscriptions } 
                });
                break;
                
            case 'get_system_stats':
                this.sendSystemStats(ws);
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    async sendSystemStats(ws) {
        if (!this.contract) return;
        
        try {
            const [systemHealth, circuitBreakerState, poolBalances, totalUsers] = await Promise.all([
                this.contract.getSystemHealth(),
                this.contract.getCircuitBreakerState(),
                this.contract.getPoolBalances(),
                this.contract.totalUsers()
            ]);
            
            this.sendToClient(ws, {
                type: 'system_stats',
                data: {
                    systemHealth: {
                        performanceScore: systemHealth.performanceScore.toString(),
                        totalGasUsed: systemHealth.totalGasUsed.toString(),
                        lastHealthCheck: systemHealth.lastHealthCheck.toString(),
                        usersProcessed: systemHealth.usersProcessed.toString()
                    },
                    circuitBreaker: {
                        isOpen: circuitBreakerState.isOpen,
                        consecutiveFailures: circuitBreakerState.consecutiveFailures.toString(),
                        lastFailureTime: circuitBreakerState.lastFailureTime.toString()
                    },
                    poolBalances: poolBalances.map(balance => balance.toString()),
                    totalUsers: totalUsers.toString(),
                    timestamp: Date.now()
                }
            });
            
        } catch (error) {
            console.error('Error sending system stats:', error);
        }
    }

    async setupEventListeners() {
        if (!this.contract) {
            console.log('⚠️  Contract not available, setting up demo events');
            this.setupDemoEvents();
            return;
        }
        
        // Real-time events
        this.contract.on('RealTimeEvent', (eventType, user, eventData, event) => {
            this.broadcastEvent('real_time_event', {
                eventType,
                user,
                eventData,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: Date.now()
            });
        });
        
        // User registration events
        this.contract.on('UserRegistered', (userId, userAddress, sponsor, packageTier, amount, event) => {
            this.broadcastEvent('user_registered', {
                userId: userId.toString(),
                userAddress,
                sponsor,
                packageTier: packageTier.toString(),
                amount: amount.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: Date.now()
            });
        });
        
        // Withdrawal events
        this.contract.on('WithdrawalMade', (user, amount, timestamp, event) => {
            this.broadcastEvent('withdrawal_made', {
                user,
                amount: amount.toString(),
                timestamp: timestamp.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
        
        // Distribution events
        this.contract.on('GlobalHelpDistributed', (totalAmount, usersCount, timestamp, event) => {
            this.broadcastEvent('global_help_distributed', {
                totalAmount: totalAmount.toString(),
                usersCount: usersCount.toString(),
                timestamp: timestamp.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
        
        this.contract.on('LeaderBonusDistributed', (totalAmount, leadersCount, timestamp, event) => {
            this.broadcastEvent('leader_bonus_distributed', {
                totalAmount: totalAmount.toString(),
                leadersCount: leadersCount.toString(),
                timestamp: timestamp.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
        
        // Automation events
        this.contract.on('AutomationExecuted', (taskType, amount, success, event) => {
            this.broadcastEvent('automation_executed', {
                taskType: taskType.toString(),
                amount: amount.toString(),
                success,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: Date.now()
            });
        });
        
        this.contract.on('AutomationFailed', (taskType, reason, timestamp, event) => {
            this.broadcastEvent('automation_failed', {
                taskType: taskType.toString(),
                reason,
                timestamp: timestamp.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
        
        // Circuit breaker events
        this.contract.on('CircuitBreakerTriggered', (consecutiveFailures, timestamp, event) => {
            this.broadcastEvent('circuit_breaker_triggered', {
                consecutiveFailures: consecutiveFailures.toString(),
                timestamp: timestamp.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
        
        this.contract.on('CircuitBreakerReset', (admin, timestamp, event) => {
            this.broadcastEvent('circuit_breaker_reset', {
                admin,
                timestamp: timestamp.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
        
        // System health events
        this.contract.on('SystemHealthUpdate', (performanceScore, totalGasUsed, usersProcessed, event) => {
            this.broadcastEvent('system_health_update', {
                performanceScore: performanceScore.toString(),
                totalGasUsed: totalGasUsed.toString(),
                usersProcessed: usersProcessed.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: Date.now()
            });
        });
        
        // Emergency events
        this.contract.on('EmergencyModeActivated', (admin, timestamp, event) => {
            this.broadcastEvent('emergency_mode_activated', {
                admin,
                timestamp: timestamp.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
        
        this.contract.on('EmergencyModeDeactivated', (admin, timestamp, event) => {
            this.broadcastEvent('emergency_mode_deactivated', {
                admin,
                timestamp: timestamp.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
        
        console.log('✅ Event listeners set up successfully');
    }

    setupDemoEvents() {
        // Send demo events for testing when contract is not available
        setInterval(() => {
            const demoEvents = [
                {
                    type: 'user_registered',
                    data: {
                        userId: Math.floor(Math.random() * 1000),
                        userAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
                        sponsor: `0x${Math.random().toString(16).substr(2, 40)}`,
                        packageTier: Math.floor(Math.random() * 5) + 1,
                        amount: (Math.random() * 1000).toFixed(2),
                        timestamp: Date.now()
                    }
                },
                {
                    type: 'system_health_update',
                    data: {
                        performanceScore: Math.floor(Math.random() * 40) + 60,
                        totalGasUsed: Math.floor(Math.random() * 1000000),
                        usersProcessed: Math.floor(Math.random() * 100),
                        timestamp: Date.now()
                    }
                }
            ];
            
            const randomEvent = demoEvents[Math.floor(Math.random() * demoEvents.length)];
            this.broadcastEvent(randomEvent.type, randomEvent.data);
            
        }, 5000); // Demo event every 5 seconds
    }

    broadcastEvent(type, data) {
        const message = {
            type,
            data,
            timestamp: Date.now()
        };
        
        this.systemHealth.lastEventTime = Date.now();
        this.systemHealth.totalEvents++;
        
        console.log(`📡 Broadcasting event: ${type}`, data);
        
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                // Check subscription filter
                if (!client.subscriptions || client.subscriptions.includes('all') || client.subscriptions.includes(type)) {
                    this.sendToClient(client, message);
                }
            }
        });
    }

    sendToClient(client, message) {
        try {
            client.send(JSON.stringify(message));
        } catch (error) {
            console.error('Error sending message to client:', error);
            this.clients.delete(client);
            this.systemHealth.clientsConnected = this.clients.size;
        }
    }

    async stop() {
        console.log('🛑 Stopping OrphiWebSocketServer...');
        
        if (this.wss) {
            this.wss.close();
        }
        
        if (this.httpServer) {
            this.httpServer.close();
        }
        
        if (this.contract) {
            this.contract.removeAllListeners();
        }
        
        console.log('✅ Server stopped successfully');
    }
}

// Export for use as module
module.exports = OrphiWebSocketServer;

// Run server if called directly
if (require.main === module) {
    const config = {
        port: process.env.WS_PORT || 8080,
        httpPort: process.env.HTTP_PORT || 3001,
        rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
        contractAddress: process.env.ENHANCED_V4ULTRA_ADDRESS
    };
    
    const server = new OrphiWebSocketServer(config);
    
    server.start().catch(error => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });
}
