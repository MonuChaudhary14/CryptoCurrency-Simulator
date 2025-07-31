document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-link");
  const panes = document.querySelectorAll(".tab-pane");
  const dropdown = document.querySelector(".user-dropdown .dropdown-content");
  const dropbtn = document.querySelector(".user-dropdown .dropbtn");

  // Auto-hide flash messages after 3 seconds
  document.querySelectorAll('.flash-message').forEach(flash => {
    setTimeout(() => {
      flash.classList.add('fade-out');
      setTimeout(() => flash.remove(), 500);
    }, 3000);
  });

  // Toggle dropdown menu
  if (dropbtn) {
    dropbtn.addEventListener('click', e => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
  }
  document.addEventListener('click', () => {
    if (dropdown) dropdown.classList.remove('show');
  });
  document.addEventListener('keydown', e => {
    if (e.key === "Escape") {
      if (document.getElementById('blockModal')) document.getElementById('blockModal').style.display = 'none';
      if (document.getElementById('miningModal')) document.getElementById('miningModal').style.display = 'none';
      if (dropdown) dropdown.classList.remove('show');
    }
  });

  // Clear active tabs/panes
  function clearTabs() {
    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));
  }

  // Show a specific tab and load relevant content
  async function showTab(tabId) {
    clearTabs();
    const tab = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
    const pane = document.getElementById(tabId);
    if (tab && pane) {
      tab.classList.add('active');
      pane.classList.add('active');

      switch(tabId) {
        case 'balances':
          await fetchBalances();
          break;
        case 'transactions':
          await fetchBlockchain();
          break;
        case 'pending':
          await fetchPendingTransactions();
          break;
        case 'search':
          // nothing to do initially
          break;
        case 'history':
          await loadProfileHistory();
          break;
        default:
          break;
      }
    }
  }

  // Attach tab click listeners
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      showTab(tab.dataset.tab);
    });
  });

  // Activate first tab on page load
  const initialTab = document.querySelector('.tab-link.active');
  if (initialTab) showTab(initialTab.dataset.tab);

  async function fetchBalances() {
    const container = document.getElementById('balanceList');
    if (!container) return;
    container.textContent = 'Loading balances...';
    try {
      const res = await fetch('/balances');
      if (!res.ok) throw new Error('Failed to get balances');
      const data = await res.json();
      let html = '<ul>';
      for (const [code, bal] of Object.entries(data)) {
        html += `<li><strong>${code}</strong>: ${bal.toFixed(2)} SIM</li>`;
      }
      html += '</ul>';
      container.innerHTML = html;
    } catch {
      container.textContent = 'Failed to load balances.';
    }
  }

  async function fetchBlockchain() {
    const container = document.getElementById('blockchainContainer');
    if (!container) return;
    container.textContent = 'Loading blockchain...';
    try {
      const res = await fetch('/chain');
      if (!res.ok) throw new Error('Failed to get chain');
      const blocks = await res.json();
      if (blocks.length === 0) {
        container.textContent = 'Blockchain is empty.';
        return;
      }
      let html = '<div class="blockchain-chain">';
      blocks.forEach((block, idx) => {
        const isGenesis = block.index === 0;
        html += `
          <div class="block ${isGenesis ? 'genesis' : ''}" tabindex="0" role="button" onclick="showBlockDetails(${block.index})" aria-label="View details of block ${block.index}">
            <div class="block-header">Block #${block.index}</div>
            <div class="block-info">
              <div><strong>Hash:</strong></div>
              <div class="block-hash">${block.hash.substring(0,16)}...</div>
              <div><strong>Nonce:</strong> ${block.nonce}</div>
              <div><strong>Transactions:</strong> ${block.transactions.length}</div>
              ${block.mining_time ? `<div><strong>Time:</strong> ${block.mining_time.toFixed(2)}s</div>` : ''}
            </div>
          </div>`;
        if (idx < blocks.length - 1) {
          html += '<div class="blockchain-arrow" aria-hidden="true">→</div>';
        }
      });
      html += '</div>';
      container.innerHTML = html;
    } catch {
      container.textContent = 'Failed to load blockchain data.';
    }
  }

  async function fetchPendingTransactions() {
    const container = document.getElementById('pendingTransactionsContainer');
    if (!container) return;
    container.textContent = 'Loading pending transactions...';
    try {
      const res = await fetch('/pending_transactions');
      if (!res.ok) throw new Error('Failed to get pending transactions');
      const txs = await res.json();
      if (txs.length === 0) {
        container.textContent = 'No pending transactions.';
        return;
      }
      const blocksHtml = txs.map(tx => {
        const dateStr = new Date(tx.timestamp * 1000).toLocaleString();
        return `
          <div class="pending-transaction-block">
            <p><strong>From:</strong> ${tx.sender_code}</p>
            <p><strong>To:</strong> ${tx.recipient_code}</p>
            <p><strong>Amount:</strong> ${tx.amount.toFixed(2)} SIM</p>
            <p><small><em>${dateStr}</em></small></p>
          </div>
        `;
      }).join('');
      container.innerHTML = blocksHtml;
    } catch {
      container.textContent = 'Failed to load pending transactions.';
    }
  }

  async function loadProfileHistory() {
    const pendingDiv = document.getElementById('profilePendingTxs');
    const confirmedDiv = document.getElementById('profileConfirmedTxs');
    if (!pendingDiv || !confirmedDiv) return;
    pendingDiv.textContent = 'Loading...';
    confirmedDiv.textContent = 'Loading...';
    try {
      const res = await fetch('/history');
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();

      function renderTxList(txs) {
        if (!txs || txs.length === 0) return '<p>None</p>';
        return `<ul>${txs.map(tx => `<li>To <strong>${tx.recipient_code}</strong>: ${tx.amount.toFixed(2)} SIM</li>`).join('')}</ul>`;
      }

      pendingDiv.innerHTML = renderTxList(data.pending);
      confirmedDiv.innerHTML = renderTxList(data.confirmed);
    } catch {
      pendingDiv.textContent = 'Failed to load pending transactions.';
      confirmedDiv.textContent = 'Failed to load completed transactions.';
    }
  }

  // Search functionality in Search tab
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', async e => {
      e.preventDefault();
      const indexVal = document.getElementById('searchIndex').value.trim();
      const hashVal = document.getElementById('searchHash').value.trim();
      const resultsDiv = document.getElementById('searchResults');
      resultsDiv.textContent = 'Searching...';

      if (!indexVal && !hashVal) {
        resultsDiv.textContent = 'Please enter search criteria.';
        return;
      }

      try {
        if (indexVal !== '') {
          // Search block by index
          const res = await fetch(`/block/${indexVal}`);
          if (!res.ok) throw new Error('Block not found');
          const block = await res.json();
          resultsDiv.innerHTML = formatBlockDetails(block);
          showModal('blockModal');
        } else {
          // Search transactions by hash or sender or recipient code via backend
          const q = encodeURIComponent(hashVal);
          const res = await fetch(`/search_transactions?q=${q}`);
          if (!res.ok) throw new Error('Search failed');
          const txs = await res.json();
          if(txs.length === 0) {
            resultsDiv.textContent = 'No transactions found.';
          } else {
            resultsDiv.innerHTML = txs.map(tx => 
              `<div class="pending-transaction-block">
                <p><strong>From:</strong> ${tx.sender_code}</p>
                <p><strong>To:</strong> ${tx.recipient_code}</p>
                <p><strong>Amount:</strong> ${tx.amount.toFixed(2)} SIM</p>
              </div>`).join('');
          }
        }
      } catch (err) {
        resultsDiv.textContent = `Search error: ${err.message}`;
      }
    });
  }

  // Modal control and helpers
  const blockModal = document.getElementById('blockModal');
  const miningModal = document.getElementById('miningModal');
  const blockDetails = document.getElementById('blockDetails');
  const closeButtons = document.querySelectorAll('.close');

  closeButtons.forEach(btn => btn.onclick = () => {
    blockModal.style.display = 'none';
    miningModal.style.display = 'none';
  });

  window.onclick = e => {
    if (e.target === blockModal) blockModal.style.display = 'none';
    if (e.target === miningModal) miningModal.style.display = 'none';
  };

  window.showBlockDetails = async function(index) {
    blockDetails.textContent = 'Loading...';
    blockModal.style.display = 'block';
    try {
      const res = await fetch(`/block/${index}`);
      if (!res.ok) throw new Error('Block not found');
      const block = await res.json();
      blockDetails.innerHTML = formatBlockDetails(block);
    } catch(e) {
      blockDetails.textContent = `Error loading block: ${e.message}`;
    }
  }

  function formatBlockDetails(block) {
    let html = `
      <p><strong>Index:</strong> ${block.index}</p>
      <p><strong>Hash:</strong></p><div class="hash-display">${block.hash}</div>
      <p><strong>Previous Hash:</strong></p><div class="hash-display">${block.previous_hash}</div>
      <p><strong>Nonce:</strong> ${block.nonce}</p>
      <p><strong>Timestamp:</strong> ${new Date(block.timestamp * 1000).toLocaleString()}</p>
      <p><strong>Mining Time:</strong> ${block.mining_time ? block.mining_time.toFixed(2) + 's' : 'N/A'}</p>
      <p><strong>Miner:</strong> ${block.miner || 'N/A'}</p>
      <p><strong>Transactions (${block.transactions.length}):</strong></p>`;

    if (block.transactions.length > 0) {
      html += '<ul>';
      block.transactions.forEach(tx => {
        html += `<li>From <strong>${tx.sender_code}</strong> to <strong>${tx.recipient_code}</strong>: ${tx.amount.toFixed(2)} SIM</li>`;
      });
      html += '</ul>';
    } else {
      html += '<p>No transactions.</p>';
    }
    return html;
  }

  // Mining modal and simulation
  let miningInterval = null;
  let miningStartTime = null;

  window.startMining = async function() {
    const miningIndex = document.getElementById('miningIndex');
    const currentHash = document.getElementById('currentHash');
    const currentNonce = document.getElementById('currentNonce');
    const timeElapsed = document.getElementById('timeElapsed');
    const miningResult = document.getElementById('miningResult');
    const finalNonce = document.getElementById('finalNonce');
    const finalHash = document.getElementById('finalHash');
    const miningTime = document.getElementById('miningTime');
    const miningModal = document.getElementById('miningModal');

    miningResult.style.display = 'none';
    miningModal.style.display = 'block';

    try {
      // Get mining info
      const progressRes = await fetch('/mine_progress');
      const progressData = await progressRes.json();

      if (progressData.error) {
        alert(progressData.error);
        miningModal.style.display = 'none';
        return;
      }

      miningIndex.textContent = progressData.index;
      currentNonce.textContent = 0;
      timeElapsed.textContent = '0.00s';
      currentHash.textContent = 'Searching...';
      miningStartTime = Date.now();

      miningInterval = setInterval(() => {
        const elapsed = (Date.now() - miningStartTime) / 1000;
        timeElapsed.textContent = elapsed.toFixed(2) + 's';
        currentHash.textContent = generateRandomHash();
        currentNonce.textContent = parseInt(currentNonce.textContent) + 1;
      }, 100);

      const mineRes = await fetch('/mine', { method: 'POST' });
      clearInterval(miningInterval);

      if (mineRes.ok) {
        const mineData = await mineRes.json();
        finalNonce.textContent = mineData.nonce;
        finalHash.textContent = mineData.hash;
        miningTime.textContent = mineData.mining_time.toFixed(2) + 's';
        miningResult.style.display = 'block';
      } else {
        alert('Mining failed.');
        miningModal.style.display = 'none';
      }
    } catch (e) {
      alert('Mining error: ' + e.message);
      miningModal.style.display = 'none';
    }
  };

  function generateRandomHash() {
    const chars = "0123456789abcdef";
    let hash = "";
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * 16)];
    }
    return hash;
  }

  window.closeMiningModal = () => {
    document.getElementById('miningModal').style.display = 'none';
    window.location.reload();
  };

});
