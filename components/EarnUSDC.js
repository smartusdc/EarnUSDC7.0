// components/EarnUSDC.js

// Network Configuration
const BASE_NETWORK_ID = '8453';
const CONTRACT_ADDRESS = '0x3038eBDFF5C17d9B0f07871b66FCDc7B9329fCD8';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

// Contract ABIs
const CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "uint256", "name": "referralCode", "type": "uint256"}
        ],
        "name": "depositFunds",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "claimDepositReward",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "claimReferralReward",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "generateReferralCode",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "deposits",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "depositRewards",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "referralRewards",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "currentAPR",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "userReferrals",
        "outputs": [
            {"internalType": "address", "name": "referrer", "type": "address"},
            {"internalType": "uint256", "name": "referralCode", "type": "uint256"},
            {"internalType": "bool", "name": "exists", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const USDC_ABI = [
    {
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

export const EarnUSDC = () => {
    const container = document.createElement('div');
    container.className = 'max-w-xl mx-auto p-4';

    // State Management
    let web3;
    let account = '';
    let contract;
    let usdcContract;
    let isProcessing = false;
    let txNonce = null;
    
    // Contract State
    let currentAPRValue = 2400;    // 24.00%
    let referrerRate = 500;        // 5.00%
    let referredRate = 700;        // 7.00%
    let userReferralState = null;
    let updateInterval = null;

    // WebSocket Provider for Events
    let wsProvider = null;

// 1. 金額変換関数の修正 - 完全置換
const toUSDCAmount = (amount) => {
    try {
        if (!amount) return web3.utils.toBN(0);
        const value = amount.toString().replace(',', '');
        const multiplier = web3.utils.toBN(10).pow(web3.utils.toBN(USDC_DECIMALS));
        const eth = web3.utils.toWei(value, 'ether');
        return web3.utils.toBN(eth).div(web3.utils.toBN(web3.utils.toWei('1', 'ether'))).mul(multiplier);
    } catch (err) {
        console.error('toUSDCAmount error:', err);
        throw new Error('Invalid amount format');
    }
};

// 2. USDC表示金額変換関数の修正 - 完全置換
const fromUSDCAmount = (amountWei) => {
    try {
        if (!amountWei) return '0';
        const amount = web3.utils.toBN(amountWei);
        const divisor = web3.utils.toBN(10).pow(web3.utils.toBN(USDC_DECIMALS));
        const converted = amount.div(divisor);
        return converted.toString();
    } catch (err) {
        console.error('fromUSDCAmount error:', err);
        return '0';
    }
};

    const formatUSDC = (amount) => {
        try {
            return Number(amount).toLocaleString('en-US', {
                minimumFractionDigits: USDC_DECIMALS,
                maximumFractionDigits: USDC_DECIMALS
            });
        } catch (err) {
            return '0.000000';
        }
    };

    // Dynamic Gas Price Management
    async function getCurrentGasPrice() {
        try {
            // Get latest blocks for gas price analysis
            const latestBlock = await web3.eth.getBlock('latest');
            const blockCount = 10; // Use last 10 blocks for more stable estimation
            const blocks = await Promise.all(
                Array.from({length: blockCount}, (_, i) => 
                    web3.eth.getBlock(latestBlock.number - i)
                )
            );

            // Calculate base fee based on recent blocks
            const baseFees = blocks
                .map(block => web3.utils.toBN(block.baseFeePerGas))
                .sort((a, b) => a.cmp(b));
            
            // Use median base fee for stability
            const medianBaseFee = baseFees[Math.floor(baseFees.length / 2)];
            
            // Get network congestion multiplier
            const congestionMultiplier = await calculateNetworkCongestion(blocks);
            
            // Get priority fee based on network conditions
            const maxPriorityFeePerGas = await calculateOptimalPriorityFee(blocks);

            // Calculate final gas price with safety buffer
            const baseWithBuffer = medianBaseFee.mul(
                web3.utils.toBN(Math.floor(congestionMultiplier * 100))
            ).div(web3.utils.toBN(100));

            return {
                maxFeePerGas: baseWithBuffer.add(
                    web3.utils.toBN(maxPriorityFeePerGas)
                ).toString(),
                maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
                baseFee: medianBaseFee.toString()
            };
        } catch (err) {
            console.error('Gas price calculation failed:', err);
            // Fallback to safe default values for Base network
            return {
                maxFeePerGas: web3.utils.toWei('0.0001', 'gwei'),
                maxPriorityFeePerGas: web3.utils.toWei('0.00001', 'gwei'),
                baseFee: web3.utils.toWei('0.00005', 'gwei')
            };
        }
    }

    // Network Congestion Analysis
    async function calculateNetworkCongestion(blocks) {
        // Analyze gas used vs gas limit ratio
        const congestionRatios = blocks.map(block => 
            web3.utils.toBN(block.gasUsed)
            .mul(web3.utils.toBN(100))
            .div(web3.utils.toBN(block.gasLimit))
            .toNumber() / 100
        );

        // Calculate weighted average with recent blocks having more weight
        const weightedSum = congestionRatios.reduce((sum, ratio, index) => 
            sum + ratio * (blocks.length - index), 0
        );
        const weights = blocks.length * (blocks.length + 1) / 2;
        const avgCongestion = weightedSum / weights;

        // Return multiplier between 1.0 and 1.5 based on congestion
        return Math.min(1.0 + avgCongestion / 2, 1.5);
    }

    // Optimal Priority Fee Calculation
    async function calculateOptimalPriorityFee(blocks) {
        try {
            const pendingBlock = await web3.eth.getBlock('pending');
            const pendingTxCount = pendingBlock.transactions.length;
            
            // Base priority fee
            let priorityFee = web3.utils.toBN(web3.utils.toWei('0.00001', 'gwei'));
            
            // Adjust based on pending transactions
            if (pendingTxCount > 0) {
                const multiplier = Math.min(1 + (pendingTxCount / 100), 2);
                priorityFee = priorityFee.mul(
                    web3.utils.toBN(Math.floor(multiplier * 100))
                ).div(web3.utils.toBN(100));
            }

            return priorityFee;
        } catch (err) {
            // Return minimum viable priority fee for Base
            return web3.utils.toBN(web3.utils.toWei('0.00001', 'gwei'));
        }
    }

    // Transaction Management
    async function sendTransaction(method, params = {}) {
        const gasPrice = await getCurrentGasPrice();
        
        // Get next nonce
        if (txNonce === null) {
            txNonce = await web3.eth.getTransactionCount(account);
        } else {
            txNonce++;
        }

        // Estimate gas with larger safety margin
        const gasEstimate = await method.estimateGas({
            from: account,
            ...params
        });

        // Add 20% buffer to gas estimate
        const gasLimit = Math.floor(gasEstimate * 1.2);

        // Pre-flight simulation
        try {
            await method.call({
                from: account,
                ...params
            });
        } catch (err) {
            throw new Error(`Transaction will fail: ${err.message}`);
        }

        const txParams = {
            from: account,
            gas: gasLimit,
            maxFeePerGas: gasPrice.maxFeePerGas,
            maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
            nonce: txNonce,
            ...params
        };

        return method.send(txParams)
            .on('transactionHash', (hash) => {
                showInfo(`Transaction submitted: ${hash}`);
            })
            .on('receipt', (receipt) => {
                if (receipt.status) {
                    showSuccess('Transaction successful');
                } else {
                    showError('Transaction failed');
                    // Reset nonce on failure
                    txNonce = null;
                }
            })
            .on('error', (err) => {
                showError(err.message);
                // Reset nonce on error
                txNonce = null;
            });
    }

// Contract State Management
    async function updateContractState() {
        if (!web3 || !account || !contract || !usdcContract) return;

        try {
            // Get all state in parallel
            const [
                baseAPR,
                referralInfo,
                depositBalance,
                depositRewardBalance,
                referralRewardBalance,
                usdcBalance
            ] = await Promise.all([
                contract.methods.currentAPR().call(),
                contract.methods.userReferrals(account).call(),
                contract.methods.deposits(account).call(),
                contract.methods.depositRewards(account).call(),
                contract.methods.referralRewards(account).call(),
                usdcContract.methods.balanceOf(account).call()
            ]);

            // Update contract state
            currentAPRValue = parseInt(baseAPR);
            userReferralState = referralInfo;

            // Calculate effective APR including referral bonus if applicable
            const effectiveAPR = referralInfo.exists ? 
                currentAPRValue + referredRate : 
                currentAPRValue;

            // Update UI
            updateUI({
                depositBalance: fromUSDCAmount(depositBalance),
                depositRewards: fromUSDCAmount(depositRewardBalance),
                referralRewards: fromUSDCAmount(referralRewardBalance),
                usdcBalance: fromUSDCAmount(usdcBalance),
                effectiveAPR: effectiveAPR,
                referralCode: referralInfo.referralCode > 0 ? 
                    referralInfo.referralCode.toString().padStart(6, '0') : ''
            });

        } catch (err) {
            console.error('Failed to update contract state:', err);
            showError('Failed to update state');
        }
    }

    // Contract Operations
    async function handleDeposit() {
        if (!web3 || !account || isProcessing) return;

        const amountInput = document.getElementById('depositAmount');
        if (!amountInput || !amountInput.value || Number(amountInput.value) <= 0) {
            showError('Please enter a valid amount');
            return;
        }

        setProcessing(true);
        try {
            const amountWei = toUSDCAmount(amountInput.value);
            
            // Check USDC allowance
            const allowance = await usdcContract.methods.allowance(
                account, 
                CONTRACT_ADDRESS
            ).call();

            // Approve if needed
            if (web3.utils.toBN(allowance).lt(web3.utils.toBN(amountWei))) {
                await sendTransaction(
                    usdcContract.methods.approve(CONTRACT_ADDRESS, amountWei)
                );
            }

            // Get referral code if exists
            const referralInput = document.getElementById('referralCodeInput');
            const referralCode = referralInput?.value || '0';

            // Validate referral code format
            if (referralCode !== '0') {
                if (!/^\d{6}$/.test(referralCode)) {
                    throw new Error('Invalid referral code format');
                }
            }

            // Execute deposit
            await sendTransaction(
                contract.methods.depositFunds(amountWei, referralCode)
            );

            amountInput.value = '';
            if (referralInput) referralInput.value = '';
            await updateContractState();
        } catch (err) {
            showError(err.message);
        } finally {
            setProcessing(false);
        }
    }

    async function handleWithdraw() {
        if (!web3 || !account || isProcessing) return;

        const amountInput = document.getElementById('withdrawAmount');
        if (!amountInput || !amountInput.value || Number(amountInput.value) <= 0) {
            showError('Please enter a valid amount');
            return;
        }

        setProcessing(true);
        try {
            const amountWei = toUSDCAmount(amountInput.value);
            
            // Check deposit balance
            const depositBalance = await contract.methods.deposits(account).call();
            if (web3.utils.toBN(depositBalance).lt(web3.utils.toBN(amountWei))) {
                throw new Error('Insufficient deposit balance');
            }

            await sendTransaction(
                contract.methods.withdraw(amountWei)
            );

            amountInput.value = '';
            await updateContractState();
        } catch (err) {
            showError(err.message);
        } finally {
            setProcessing(false);
        }
    }

    async function handleApplyReferral() {
    if (!web3 || !account || isProcessing) return;

    const referralInput = document.querySelector('#referralCodeInput');
    if (!referralInput?.value || !/^\d{6}$/.test(referralInput.value)) {
        showError('Please enter a valid 6-digit referral code');
        return;
    }

    setProcessing(true);
    try {
        // リファラルコードの適用は次回デポジット時に行われるため
        // ここではバリデーションのみ
        await contract.methods.referralCodeToUser(referralInput.value).call();
        showSuccess('Referral code will be applied on your next deposit');
        referralInput.value = '';
    } catch (err) {
        showError('Invalid referral code');
    } finally {
        setProcessing(false);
    }
}

    async function handleClaimDepositReward() {
        if (!web3 || !account || isProcessing) return;

        setProcessing(true);
        try {
            const rewards = await contract.methods.depositRewards(account).call();
            if (web3.utils.toBN(rewards).isZero()) {
                throw new Error('No deposit rewards to claim');
            }

            await sendTransaction(
                contract.methods.claimDepositReward()
            );

            await updateContractState();
        } catch (err) {
            showError(err.message);
        } finally {
            setProcessing(false);
        }
    }

    async function handleClaimReferralReward() {
        if (!web3 || !account || isProcessing) return;

        setProcessing(true);
        try {
            const rewards = await contract.methods.referralRewards(account).call();
            if (web3.utils.toBN(rewards).isZero()) {
                throw new Error('No referral rewards to claim');
            }

            await sendTransaction(
                contract.methods.claimReferralReward()
            );

            await updateContractState();
        } catch (err) {
            showError(err.message);
        } finally {
            setProcessing(false);
        }
    }

    async function handleGenerateReferral() {
        if (!web3 || !account || isProcessing) return;

        setProcessing(true);
        try {
            const referralInfo = await contract.methods.userReferrals(account).call();
            if (referralInfo.exists && referralInfo.referralCode > 0) {
                throw new Error('You already have a referral code');
            }

            await sendTransaction(
                contract.methods.generateReferralCode()
            );

            await updateContractState();
        } catch (err) {
            showError(err.message);
        } finally {
            setProcessing(false);
        }
    }

// UI Components
    function createUnconnectedUI() {
        return `
            <div class="bg-white shadow-xl rounded-lg overflow-hidden">
                <!-- レート情報（固定表示） -->
                <div class="bg-blue-50 p-4 border-b sticky top-0">
                    <div class="text-2xl font-bold text-center">
                        Current APR: ${(currentAPRValue/100).toFixed(2)}%
                    </div>
                    <div class="text-sm text-gray-600 text-center mt-2">
                        Referral Rewards: Referrer ${(referrerRate/100).toFixed(2)}%, 
                        Referred ${(referredRate/100).toFixed(2)}%
                    </div>
                </div>

                <div class="p-6">
                    <button id="connectWalletBtn" 
                            class="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Connect Wallet
                    </button>
                </div>
            </div>
        `;
    }

    function createConnectedUI(data = {}) {
        const { 
            usdcBalance = '0',
            depositBalance = '0',
            depositRewards = '0',
            referralRewards = '0',
            effectiveAPR = currentAPRValue,
            referralCode = ''
        } = data;

        return `
            <div class="bg-white shadow-xl rounded-lg overflow-hidden">
                <!-- レート情報（固定表示） -->
                <div class="bg-blue-50 p-4 border-b sticky top-0">
                    <div class="text-2xl font-bold text-center">
                        Current APR: ${(effectiveAPR/100).toFixed(2)}%
                        ${userReferralState?.exists ? 
                            '<span class="text-sm text-green-600">(Includes Referral Bonus)</span>' : 
                            ''}
                    </div>
                    <div class="text-sm text-gray-600 text-center mt-2">
                        Referral Rewards: Referrer ${(referrerRate/100).toFixed(2)}%, 
                        Referred ${(referredRate/100).toFixed(2)}%
                    </div>
                </div>

                <!-- リファラルコード入力セクション -->
                ${!userReferralState?.exists ? `
                    <div class="p-4 border-b bg-green-50">
                        <div class="space-y-2">
                            <input type="text" 
                                   id="referralCodeInput" 
                                   pattern="[0-9]{6}"
                                   maxlength="6"
                                   placeholder="Enter 6-digit referral code" 
                                   class="w-full p-2 border rounded">
                            <button id="applyReferralBtn" 
                                    class="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                                Apply Referral Code
                            </button>
                            <p class="text-sm text-gray-600">
                                Get ${(referredRate/100).toFixed(2)}% APR boost!
                            </p>
                        </div>
                    </div>
                ` : `
                    <div class="p-4 border-b bg-green-50">
                        <p class="text-green-600 text-center font-bold">
                            Referral bonus active! Your APR is increased by ${(referredRate/100).toFixed(2)}%
                        </p>
                    </div>
                `}

                <!-- 残高サマリー -->
                <div class="p-4 border-b">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <div class="text-sm text-gray-500">USDC Balance</div>
                            <div class="font-bold">${formatUSDC(usdcBalance)} USDC</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Deposit Balance</div>
                            <div class="font-bold">${formatUSDC(depositBalance)} USDC</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Deposit Rewards</div>
                            <div class="font-bold">${formatUSDC(depositRewards)} USDC</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Referral Rewards</div>
                            <div class="font-bold">${formatUSDC(referralRewards)} USDC</div>
                        </div>
                    </div>
                </div>

                <!-- 操作セクション -->
                <div class="p-4 space-y-4">
                    <!-- 預入フォーム -->
                    <div class="space-y-2">
                        <div class="flex gap-2">
                            <input type="number" 
                                   id="depositAmount" 
                                   min="0.01"
                                   step="0.01"
                                   placeholder="Deposit amount" 
                                   class="flex-1 p-2 border rounded">
                            <button id="maxDepositBtn" 
                                    class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                                MAX
                            </button>
                        </div>
                        <button id="depositBtn" 
                                class="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                            Deposit
                        </button>
                    </div>

                    <!-- 引出フォーム -->
                    <div class="space-y-2">
                        <div class="flex gap-2">
                            <input type="number" 
                                   id="withdrawAmount" 
                                   min="0.01"
                                   step="0.01"
                                   placeholder="Withdraw amount" 
                                   class="flex-1 p-2 border rounded">
                            <button id="maxWithdrawBtn" 
                                    class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                                MAX
                            </button>
                        </div>
                        <button id="withdrawBtn" 
                                class="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                            Withdraw
                        </button>
                    </div>

                    <!-- 報酬請求ボタン -->
                    <div class="grid grid-cols-2 gap-2">
                        <button id="claimDepositBtn" 
                                class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                            Claim Deposit Rewards
                        </button>
                        <button id="claimReferralBtn" 
                                class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                            Claim Referral Rewards
                        </button>
                    </div>
                </div>

                <!-- リファラル活動セクション -->
                <div class="p-4 bg-gray-50 border-t">
                    ${referralCode ? `
                        <div class="space-y-2">
                            <div class="flex gap-2">
                                <input type="text" 
                                       id="referralCodeDisplay"
                                       value="${referralCode}" 
                                       readonly 
                                       class="flex-1 p-2 border rounded bg-gray-100">
                                <button id="copyReferralBtn" 
                                        class="px-4 py-2 bg-blue-500 text-white rounded">
                                    Copy
                                </button>
                            </div>
                            <button id="shareReferralBtn" 
                                    class="w-full bg-blue-500 text-white px-4 py-2 rounded">
                                Share
                            </button>
                        </div>
                    ` : `
                        <button id="generateReferralBtn" 
                                class="w-full bg-blue-500 text-white px-4 py-2 rounded">
                            Generate Referral Code
                        </button>
                    `}
                </div>
            </div>
        `;
    }

// Event Handlers and Helper Functions
    async function handleCopyReferral() {
        const codeInput = container.querySelector('#referralCodeDisplay');
        if (!codeInput?.value) return;

        try {
            await navigator.clipboard.writeText(codeInput.value);
            showSuccess('Referral code copied to clipboard');
        } catch (err) {
            showError('Failed to copy referral code');
        }
    }

    function handleShare() {
        const code = container.querySelector('#referralCodeDisplay')?.value;
        if (!code) return;

        const effectiveAPR = userReferralState?.exists ? 
            currentAPRValue : currentAPRValue - referredRate;
        const aprDisplay = (effectiveAPR/100).toFixed(2);

        const text = `Join EarnUSDC on Base and earn ${aprDisplay}% APR! Use my referral code: ${code}`;
        const url = 'https://earnusdc.base.org';

        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
    }

    function handleMaxDeposit() {
        const usdcBalanceEl = container.querySelector('.balance-display');
        if (usdcBalanceEl) {
            const balance = usdcBalanceEl.textContent.split(' ')[0].replace(/,/g, '');
            document.getElementById('depositAmount').value = balance;
        }
    }

    function handleMaxWithdraw() {
        const depositBalanceEl = container.querySelector('.deposit-display');
        if (depositBalanceEl) {
            const balance = depositBalanceEl.textContent.split(' ')[0].replace(/,/g, '');
            document.getElementById('withdrawAmount').value = balance;
        }
    }

    // UI State Management
    function setProcessing(processing) {
        isProcessing = processing;
        const buttons = container.querySelectorAll('button');
        const inputs = container.querySelectorAll('input');

        buttons.forEach(button => {
            button.disabled = processing;
            button.classList.toggle('opacity-50', processing);
            button.classList.toggle('cursor-not-allowed', processing);
        });

        inputs.forEach(input => {
            input.disabled = processing;
            input.classList.toggle('opacity-50', processing);
            input.classList.toggle('cursor-not-allowed', processing);
        });

        // Processing indicator
        const indicator = container.querySelector('#processingIndicator');
        if (processing) {
            if (!indicator) {
                const newIndicator = document.createElement('div');
                newIndicator.id = 'processingIndicator';
                newIndicator.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg';
                newIndicator.textContent = 'Processing...';
                container.appendChild(newIndicator);
            }
        } else if (indicator) {
            indicator.remove();
        }
    }

    // Input Validation
    function validateAmount(input) {
        const value = input.value;
        if (value && (isNaN(value) || Number(value) <= 0)) {
            input.setCustomValidity('Please enter a valid amount');
            return false;
        }
        input.setCustomValidity('');
        return true;
    }

    function validateReferralCode(input) {
        const value = input.value;
        if (value && !/^\d{6}$/.test(value)) {
            input.setCustomValidity('Please enter a 6-digit referral code');
            return false;
        }
        input.setCustomValidity('');
        return true;
    }

    // Event Listener Attachment
    function attachEventListeners() {
        if (!account) {
            const connectBtn = container.querySelector('#connectWalletBtn');
            if (connectBtn) connectBtn.addEventListener('click', initWeb3);
            return;
        }

        // Operation buttons
        const depositBtn = container.querySelector('#depositBtn');
        const withdrawBtn = container.querySelector('#withdrawBtn');
        const claimDepositBtn = container.querySelector('#claimDepositBtn');
        const claimReferralBtn = container.querySelector('#claimReferralBtn');
        const generateReferralBtn = container.querySelector('#generateReferralBtn');
        const copyReferralBtn = container.querySelector('#copyReferralBtn');
        const shareReferralBtn = container.querySelector('#shareReferralBtn');
        const maxDepositBtn = container.querySelector('#maxDepositBtn');
        const maxWithdrawBtn = container.querySelector('#maxWithdrawBtn');
        const applyReferralBtn = container.querySelector('#applyReferralBtn');

        // Attach event listeners
        if (depositBtn) depositBtn.addEventListener('click', handleDeposit);
        if (withdrawBtn) withdrawBtn.addEventListener('click', handleWithdraw);
        if (claimDepositBtn) claimDepositBtn.addEventListener('click', handleClaimDepositReward);
        if (claimReferralBtn) claimReferralBtn.addEventListener('click', handleClaimReferralReward);
        if (generateReferralBtn) generateReferralBtn.addEventListener('click', handleGenerateReferral);
        if (copyReferralBtn) copyReferralBtn.addEventListener('click', handleCopyReferral);
        if (shareReferralBtn) shareReferralBtn.addEventListener('click', handleShare);
        if (maxDepositBtn) maxDepositBtn.addEventListener('click', handleMaxDeposit);
        if (maxWithdrawBtn) maxWithdrawBtn.addEventListener('click', handleMaxWithdraw);
        if (applyReferralBtn) applyReferralBtn.addEventListener('click', handleApplyReferral);

        // Input validation
        const depositInput = container.querySelector('#depositAmount');
        const withdrawInput = container.querySelector('#withdrawAmount');
        const referralInput = container.querySelector('#referralCodeInput');

        if (depositInput) {
            depositInput.addEventListener('input', () => validateAmount(depositInput));
        }
        if (withdrawInput) {
            withdrawInput.addEventListener('input', () => validateAmount(withdrawInput));
        }
        if (referralInput) {
            referralInput.addEventListener('input', () => validateReferralCode(referralInput));
        }
    }

    // Notifications
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg';
        errorDiv.textContent = message;
        container.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }

    function showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg';
        successDiv.textContent = message;
        container.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 5000);
    }

    function showInfo(message) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'fixed bottom-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded shadow-lg';
        infoDiv.textContent = message;
        container.appendChild(infoDiv);
        setTimeout(() => infoDiv.remove(), 5000);
    }

    // Web3 Connection Management
    async function initWeb3() {
        try {
            if (!window.ethereum) {
                showError('Please install MetaMask');
                return;
            }

            web3 = new Web3(window.ethereum);
            
            // Check network
            const chainId = await web3.eth.getChainId();
            if (chainId.toString() !== BASE_NETWORK_ID) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: web3.utils.toHex(BASE_NETWORK_ID) }],
                    });
                } catch (err) {
                    showError('Please switch to Base Network');
                    return;
                }
            }

            // Request account access
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            account = accounts[0];

            // Initialize contracts
            contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
            usdcContract = new web3.eth.Contract(USDC_ABI, USDC_ADDRESS);

            // Setup WebSocket provider for events
            setupWebSocket();

            // Setup event listeners
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            // Initial state update
            await updateContractState();
            
            // Start periodic updates
            updateInterval = setInterval(updateContractState, 30000);

            showSuccess('Connected successfully');
        } catch (err) {
            showError('Failed to connect: ' + err.message);
        }
    }

    // WebSocket Setup for Events
// setupWebSocket関数を以下に置き換え
function setupWebSocket() {
        if (wsProvider) {
            wsProvider.disconnect();
        }

 wsProvider = new Web3.providers.WebsocketProvider(
    'wss://base.getblock.io/websocket'  // あるいは他の有効なBase NetworkのWebSocket URL
);

        wsProvider.on('connect', () => {
            const wsWeb3 = new Web3(wsProvider);
            const wsContract = new wsWeb3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
            
            // Subscribe to relevant events
            subscribeToEvents(wsContract);
        });

        wsProvider.on('error', console.error);
        wsProvider.on('end', setupWebSocket);
    }

    // Event Subscriptions
    function subscribeToEvents(wsContract) {
        // Monitor relevant events and update state
        wsContract.events.allEvents({
            filter: {
                user: account
            }
        })
        .on('data', async (event) => {
            await updateContractState();
        })
        .on('error', console.error);
    }

    // Account Change Handler
    function handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            account = '';
            updateUI();
        } else if (accounts[0] !== account) {
            account = accounts[0];
            txNonce = null;  // Reset nonce on account change
            updateContractState();
        }
    }

    // Network Change Handler
    function handleChainChanged() {
        window.location.reload();
    }

    // Cleanup
    function cleanup() {
        if (window.ethereum) {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        }

        if (updateInterval) {
            clearInterval(updateInterval);
        }

        if (wsProvider) {
            wsProvider.disconnect();
        }
    }

// UI Update Function - 最初にこの関数を定義
    function updateUI(data) {
        container.innerHTML = account ? createConnectedUI(data) : createUnconnectedUI();
        attachEventListeners();
    }

    // Initialize - 関数定義の後で初期化
    updateUI();
    container.cleanup = cleanup;

    return container;
};

export default EarnUSDC;
