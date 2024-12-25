// components/EarnUSDC.js
export const EarnUSDC = () => {
    const container = document.createElement('div');
    container.className = 'max-w-xl mx-auto p-4';

    const CONTRACT_ABI = [
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "referralCode",
                    "type": "uint256"
                }
            ],
            "name": "depositFunds",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                }
            ],
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
            "inputs": [
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                }
            ],
            "name": "deposits",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "currentAPR",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "generateReferralCode",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    const USDC_ABI = [
        {
            "constant": true,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function"
        },
        {
            "constant": false,
            "inputs": [
                {"name": "_spender", "type": "address"},
                {"name": "_value", "type": "uint256"}
            ],
            "name": "approve",
            "outputs": [{"name": "", "type": "bool"}],
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [
                {"name": "_owner", "type": "address"},
                {"name": "_spender", "type": "address"}
            ],
            "name": "allowance",
            "outputs": [{"name": "", "type": "uint256"}],
            "type": "function"
        }
    ];

    const CONTRACT_ADDRESS = '0x3038eBDFF5C17d9B0f07871b66FCDc7B9329fCD8';
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const BASE_NETWORK_ID = '8453';

    let web3;
    let account = '';
    let contract;
    let usdcContract;
    let apr = 24;
    let isProcessing = false;

    // UI Elements
    const card = document.createElement('div');
    card.className = 'bg-white shadow-xl rounded-lg overflow-hidden';

    const header = document.createElement('div');
    header.className = 'p-6 bg-gray-50 border-b';
    header.innerHTML = '<h2 class="text-xl font-bold">EarnUSDC on Base</h2>';

    const content = document.createElement('div');
    content.className = 'p-6 space-y-4';

    const connectButton = document.createElement('button');
    connectButton.className = 'w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600';
    connectButton.textContent = 'Connect Wallet';
    connectButton.onclick = initWeb3;

    // Add initial UI
    content.appendChild(connectButton);
    card.appendChild(header);
    card.appendChild(content);
    container.appendChild(card);

    async function initWeb3() {
        try {
            if (window.ethereum) {
                web3 = new Web3(window.ethereum);
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                account = accounts[0];
                
                // Check network
                const chainId = await web3.eth.getChainId();
                if (chainId.toString() !== BASE_NETWORK_ID) {
                    showError('Please switch to Base Network');
                    return;
                }

                // Initialize contracts
                contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
                usdcContract = new web3.eth.Contract(USDC_ABI, USDC_ADDRESS);

                // Event listeners
                window.ethereum.on('accountsChanged', handleAccountsChanged);
                window.ethereum.on('chainChanged', handleChainChanged);

                // Update UI
                updateUI();
                setInterval(updateBalances, 30000);

            } else {
                showError('Please install MetaMask');
            }
        } catch (err) {
            showError(err.message);
        }
    }

    function handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            // MetaMask is locked or the user has not connected any accounts
            account = '';
            resetUI();
        } else if (accounts[0] !== account) {
            account = accounts[0];
            updateUI();
        }
    }

    function handleChainChanged() {
        // We recommend reloading the page unless you have good reason not to
        window.location.reload();
    }

    function resetUI() {
        content.innerHTML = '';
        content.appendChild(connectButton);
    }

    function updateUI() {
        content.innerHTML = `
            <div class="text-center mb-4">
                <div class="text-2xl font-bold">Current APR: ${apr}%</div>
                <div class="text-sm text-gray-500">Referral Rewards: Referrer 5%, Referred 7%</div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <div class="text-sm text-gray-500">Your USDC Balance</div>
                    <div class="font-bold balance-display">Loading...</div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">Your Deposit</div>
                    <div class="font-bold deposit-display">Loading...</div>
                </div>
            </div>

            <div class="space-y-4">
                <div class="deposit-section">
                    <div class="flex gap-2 mb-2">
                        <input type="number" id="depositAmount" placeholder="Deposit amount" 
                               class="flex-1 p-2 border rounded">
                        <button id="maxDepositBtn" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                            MAX
                        </button>
                    </div>
                    <input type="number" id="referralCode" placeholder="Referral code (optional)" 
                           class="w-full p-2 border rounded mb-2">
                    <button id="depositBtn" class="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Deposit
                    </button>
                </div>

                <div class="withdraw-section">
                    <div class="flex gap-2 mb-2">
                        <input type="number" id="withdrawAmount" placeholder="Withdraw amount" 
                               class="flex-1 p-2 border rounded">
                        <button id="maxWithdrawBtn" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                            MAX
                        </button>
                    </div>
                    <button id="withdrawBtn" class="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Withdraw
                    </button>
                </div>

                <button id="claimBtn" class="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                    Claim Rewards
                </button>
            </div>
        `;

        // Add event listeners
        document.getElementById('depositBtn').addEventListener('click', handleDeposit);
        document.getElementById('withdrawBtn').addEventListener('click', handleWithdraw);
        document.getElementById('claimBtn').addEventListener('click', handleClaim);
        document.getElementById('maxDepositBtn').addEventListener('click', handleMaxDeposit);
        document.getElementById('maxWithdrawBtn').addEventListener('click', handleMaxWithdraw);

        updateBalances();
    }

    async function updateBalances() {
        if (!web3 || !account || !contract || !usdcContract) return;

        try {
            const [depositBalance, usdcBal, currentApr] = await Promise.all([
                contract.methods.deposits(account).call(),
                usdcContract.methods.balanceOf(account).call(),
                contract.methods.currentAPR().call()
            ]);

            const userDeposit = web3.utils.fromWei(depositBalance, 'mwei');
            const usdcBalance = web3.utils.fromWei(usdcBal, 'mwei');
            apr = currentApr / 100;

            // Update balance displays
            document.querySelector('.balance-display').textContent = `${Number(usdcBalance).toFixed(2)} USDC`;
            document.querySelector('.deposit-display').textContent = `${Number(userDeposit).toFixed(2)} USDC`;

            // Store values for MAX buttons
            content.dataset.usdcBalance = usdcBalance;
            content.dataset.userDeposit = userDeposit;

        } catch (err) {
            showError('Failed to update balances');
        }
    }

    async function handleDeposit() {
        if (!web3 || !contract || !account || isProcessing) return;
        
        const depositAmount = document.getElementById('depositAmount').value;
        const referralCode = document.getElementById('referralCode').value || '0';

        if (!depositAmount || depositAmount <= 0) {
            showError('Please enter a valid amount');
            return;
        }

        setProcessing(true);
        try {
            const amount = web3.utils.toWei(depositAmount, 'mwei');
            
            // First approve USDC
            await usdcContract.methods.approve(CONTRACT_ADDRESS, amount)
                .send({ from: account });

            // Then deposit
            await contract.methods.depositFunds(amount, referralCode)
                .send({ from: account });

            // Clear inputs and update balances
            document.getElementById('depositAmount').value = '';
            document.getElementById('referralCode').value = '';
            await updateBalances();
            showSuccess('Deposit successful');

        } catch (err) {
            showError(err.message);
        } finally {
            setProcessing(false);
        }
    }

    async function handleWithdraw() {
        if (!web3 || !contract || !account || isProcessing) return;
        
        const withdrawAmount = document.getElementById('withdrawAmount').value;

        if (!withdrawAmount || withdrawAmount <= 0) {
            showError('Please enter a valid amount');
            return;
        }

        setProcessing(true);
        try {
            const amount = web3.utils.toWei(withdrawAmount, 'mwei');
            await contract.methods.withdraw(amount)
                .send({ from: account });

            // Clear input and update balances
            document.getElementById('withdrawAmount').value = '';
            await updateBalances();
            showSuccess('Withdrawal successful');

        } catch (err) {
            showError(err.message);
        } finally {
            setProcessing(false);
        }
    }

    async function handleClaim() {
        if (!contract || !account || isProcessing) return;

        setProcessing(true);
        try {
            await contract.methods.claimDepositReward()
                .send({ from: account });

            await updateBalances();
            showSuccess('Rewards claimed successfully');

        } catch (err) {
            showError(err.message);
        } finally {
            setProcessing(false);
        }
    }

    function handleMaxDeposit() {
        const usdcBalance = content.dataset.usdcBalance || '0';
        document.getElementById('depositAmount').value = usdcBalance;
    }

    function handleMaxWithdraw() {
        const userDeposit = content.dataset.userDeposit || '0';
        document.getElementById('withdrawAmount').value = userDeposit;
    }

    function setProcessing(processing) {
        isProcessing = processing;
        const buttons = content.querySelectorAll('button');
        buttons.forEach(button => {
            button.disabled = processing;
            if (processing) {
                button.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                button.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });

        const inputs = content.querySelectorAll('input');
        inputs.forEach(input => {
            input.disabled = processing;
            if (processing) {
                input.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                input.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4';
        errorDiv.textContent = message;
        content.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    function showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mt-4';
        successDiv.textContent = message;
        content.appendChilsuccessDiv.textContent = message;
        content.appendChild(successDiv);

        setTimeout(() => {
            successDiv.remove();
        }, 5000);
    }

    // Format numbers with commas
    function formatNumber(number) {
        return Number(number).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Validate amount input
    function validateAmount(amount) {
        if (!amount || isNaN(amount) || amount <= 0) {
            showError('Please enter a valid amount');
            return false;
        }
        return true;
    }

    // Check if Base network is selected
    async function checkNetwork() {
        if (!web3) return false;
        try {
            const chainId = await web3.eth.getChainId();
            if (chainId.toString() !== BASE_NETWORK_ID) {
                showError('Please switch to Base Network');
                return false;
            }
            return true;
        } catch (err) {
            showError('Failed to check network');
            return false;
        }
    }

    // Clean up function for event listeners
    function cleanup() {
        if (window.ethereum) {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
    }

    // Add cleanup to handle component unmounting
    container.cleanup = cleanup;

    return container;
};

export default EarnUSDC;
