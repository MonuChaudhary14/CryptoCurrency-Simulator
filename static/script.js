document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-link");
  const panes = document.querySelectorAll(".tab-pane");
  const dropdown = document.querySelector(".dropdown-content");
  const dropbtn = document.querySelector(".dropbtn");

  document.querySelectorAll('.flash-message').forEach(flash => {
    setTimeout(() => {
      flash.classList.add('fade-out');
      setTimeout(() => flash.remove(), 500);
    }, 3000);
  });

  if (dropbtn && dropdown) {
    dropbtn.addEventListener('click', e => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        dropbtn.focus();
      }
    });
  }

  function clearActive() {
    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));
  }

  async function showTab(tabID) {
    clearActive();
    const tab = document.querySelector(`.tab-link[data-tab="${tabID}"]`);
    const pane = document.getElementById(tabID);
    if (tab && pane) {
      tab.classList.add('active');
      tab.focus();
      pane.classList.add('active');
      switch (tabID) {
        case 'balances':
          await fetchBalances();
          break;
        case 'transactions':
          await loadBlockchainVisual();
          break;
        case 'pending':
          await fetchPendingTransactions();
          break;
      }
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
    tab.addEventListener('keydown', e => {
      let index = Array.from(tabs).indexOf(tab);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        tabs[(index + 1) % tabs.length].focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        tabs[(index - 1 + tabs.length) % tabs.length].focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showTab(tab.dataset.tab);
      }
    });
  });

  const initialTab = document.querySelector(".tab-link.active");
  if (initialTab) showTab(initialTab.dataset.tab);

  async function fetchBalances() {
    const container = document.getElementById('balanceList');
    if (!container) return;
    container.textContent = 'Loading balances...';
    try {
      const res = await fetch('/balances');
      if (!res.ok) throw new Error();
      const data = await res.json();
      let html = `<table class="balances-table"><thead><tr><th>Unique ID</th><th style="text-align: left;">Balance (SIM)</th></tr></thead><tbody>`;
      if (Object.keys(data).length === 0) {
        html += `<tr><td colspan="2" style="text-align:center;">No balances found.</td></tr>`;
      } else {
        for (const [code, balance] of Object.entries(data)) {
          html += `<tr><td>${code}</td><td style="text-align: left;">${balance.toFixed(2)}</td></tr>`;
        }
      }
      html += `</tbody></table>`;
      container.innerHTML = html;
    } catch (err) {
      container.textContent = 'Error loading balances.';
    }
  }

  async function fetchPendingTransactions() {
    const container = document.getElementById('pendingTxList');
    if (!container) return;
    container.textContent = 'Loading pending transactions...';
    try {
      const res = await fetch('/pending_transactions');
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        container.textContent = 'No pending transactions.';
        return;
      }
      let html = '<ul class="tx-list">';
      data.forEach(tx => {
        html += `<li><b>From:</b> ${tx.sender_code || 'System'} <b>To:</b> ${tx.recipient_code} <b>Amount:</b> ${tx.amount ?? ''} SIM</li>`;
      });
      html += '</ul>';
      container.innerHTML = html;
    } catch (err) {
      container.textContent = 'Error loading pending transactions.';
    }
  }

  async function loadBlockchainVisual() {
    const container = document.getElementById('blockchain-visual');
    if (!container) return;
    container.textContent = "Loading blockchain...";
    try {
      const res = await fetch('/chain');
      if (!res.ok) throw new Error('Failed to load blockchain');
      const blockchain = await res.json();
      if (!Array.isArray(blockchain) || blockchain.length === 0) {
        container.textContent = "No blockchain data.";
        return;
      }
      let html = `<div class="blockchain-chain" role="list">`;
      blockchain.forEach((block, idx) => {
        html += `
          <div class="block-box" role="listitem" tabindex="0" data-index="${block.index}" aria-label="Click to view details of block #${block.index}">
            ${block.index === 0 ? "Genesis" : "Block"}<br>#${block.index}
          </div>`;
        if (idx !== blockchain.length - 1) {
          html += `<span class="chain-arrow" aria-hidden="true">&#8594;</span>`;
        }
      });
      html += `</div>`;
      container.innerHTML = html;
      container.querySelectorAll('.block-box').forEach(box => {
        box.addEventListener('click', () => {
          showBlockDetail(parseInt(box.dataset.index, 10));
        });
        box.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showBlockDetail(parseInt(box.dataset.index, 10));
          }
        });
      });
    } catch (err) {
      container.textContent = "Failed to load blockchain.";
    }
  }

  // --- Show block details modal ---
  window.showBlockDetail = async function(index) {
    const modal = document.getElementById("blockDetailModal");
    const content = document.getElementById('blockDetailContent');
    content.innerHTML = "Loading...";
    modal.style.display = 'flex';
    try {
      const res = await fetch(`/block/${index}`);
      if (!res.ok) {
        content.textContent = "Block not found.";
        return;
      }
      const block = await res.json();
      let details = `
        <h3 id="blockDetailTitle">Block #${block.index}</h3>
        <p><strong>Hash:</strong> <span class="hash-display">${block.hash}</span></p>
        <p><strong>Previous Hash:</strong> <span class="hash-display">${block.previous_hash}</span></p>
        <p><strong>Nonce:</strong> ${block.nonce}</p>
        <p><strong>Miner:</strong> ${block.miner}</p>
        <p><strong>Timestamp:</strong> ${new Date(block.timestamp * 1000).toLocaleString()}</p>
        <p><strong>Mining Time:</strong> ${block.mining_time ? block.mining_time.toFixed(2) + ' s' : 'N/A'}</p>
        <h4>Transactions (${block.transactions.length}):</h4>
        <ul>
          ${block.transactions.map(tx =>
            `<li>From ${tx.sender_code || 'System'} to ${tx.recipient_code}: ${tx.amount ?? ''} SIM</li>`
          ).join('')}
        </ul>
      `;
      content.innerHTML = details;
    } catch (err) {
      content.textContent = "Error loading block details.";
    }
  };

  // Close block detail modal
  window.closeBlockModal = function() {
    document.getElementById("blockDetailModal").style.display = "none";
  };

  // Close modal if clicked outside content
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) e.target.style.display = 'none';
  });

  // --- Mining Modal Logic ---
  window.mineBlock = async function() {
    const modal = document.getElementById('miningModal');
    const statusDiv = document.getElementById('miningStatus');
    statusDiv.innerHTML = "<strong>Preparing mining challenge...</strong>";
    modal.style.display = "flex";

    try {
      const resp = await fetch('/mine_progress');
      const meta = await resp.json();
      if (meta.error) {
        statusDiv.innerHTML = `<span style="color: #fa5;">${meta.error}</span>`;
        return;
      }
      let nonce = 0;
      let hash = "";
      let running = true;

      const animate = () => {
        if (!running) return;
        nonce += Math.floor(Math.random() * 32) + 1;
        hash = sha256(meta.index + meta.previous_hash + nonce + "simulate");
        statusDiv.innerHTML = `
          <div>
            <p style="font-size:1.1em;"><b>Mining Block #${meta.index}...</b></p>
            <p>Nonce: <b>${nonce}</b></p>
            <p>Hash: <span class="hash-display">${hash}</span></p>
            <p>Difficulty: <b>${meta.difficulty}</b> (leading zeros in hash)</p>
            <div style="color:#b0f; margin-top:1em;">Mining... Please wait.</div>
          </div>
        `;
        setTimeout(animate, 90);
      };
      animate();
      const mined = await fetch('/mine', { method: "POST" });
      running = false;
      const result = await mined.json();
      if (result.success) {
        let seconds = result.mining_time.toFixed(2);
        statusDiv.innerHTML = `
          <div class="mining-result">
            <h3>Block Successfully Mined!</h3>
            <p>Block #: <b>${result.index}</b></p>
            <p>Nonce: <b>${result.nonce}</b></p>
            <p>Hash: <span class="hash-display">${result.hash}</span></p>
            <p>Mining Time: <b>${seconds} s</b></p>
            <button class="form-button" onclick="closeMiningModal(); location.reload();">Close</button>
          </div>
        `;
      } else {
        statusDiv.innerHTML = `<span style="color:#faa;">Mining failed.</span>`;
      }
    } catch (err) {
      statusDiv.innerHTML = "<span style='color:#faa;'>Mining error.</span>";
    }
  };

  window.closeMiningModal = function() {
    document.getElementById('miningModal').style.display = 'none';
  };

  function sha256(str) {
    return Array(64).fill(0).map(() =>
      "0123456789abcdef"[Math.floor(Math.random() * 16)]
    ).join("");
  }

  document.querySelectorAll('.mine-btn').forEach(btn =>
    btn.addEventListener('click', window.mineBlock)
  );

  // --- SEARCH: Results as block instead of JSON ---
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resultsDiv = document.getElementById('searchResults');
      const type = document.getElementById('searchType').value;
      const query = document.getElementById('searchInput').value.trim();
      if (!query) {
        resultsDiv.textContent = 'Please enter a search value.';
        return;
      }
      resultsDiv.textContent = 'Searching...';

      try {
        let endpoint = '';
        if (type === 'block') {
          endpoint = `/block/${encodeURIComponent(query)}`;
        } else if (type === 'hash') {
          endpoint = `/search_hash/${encodeURIComponent(query)}`;
        } else if (type === 'code') {
          endpoint = `/search_code/${encodeURIComponent(query)}`;
        } else {
          resultsDiv.textContent = 'Invalid search type.';
          return;
        }
        const res = await fetch(endpoint);
        if (!res.ok) {
          resultsDiv.textContent = `No results found.`;
          return;
        }
        const data = await res.json();

        resultsDiv.innerHTML = ""; // Clear previous
        if (data.block) displayBlock(data.block, resultsDiv);
        else if (data.transactions && Array.isArray(data.transactions)) {
          if (data.transactions.length === 0) {
            resultsDiv.innerHTML = "<div class='search-result-block'>No matching transactions found.</div>";
          } else {
            data.transactions.forEach(tx => displayTx(tx, resultsDiv));
          }
        } else if (data.index !== undefined && data.hash) displayBlock(data, resultsDiv);
        else {
          resultsDiv.innerHTML = "<div class='search-result-block'>No structured result found.</div>";
        }
      } catch (err) {
        resultsDiv.textContent = 'Search error.';
      }
    });
  }

  function displayBlock(block, parent) {
    let html = `
      <div class="search-result-block">
        <h3>Block #${block.index}</h3>
        <p><b>Hash:</b> <span class="hash-display">${block.hash}</span></p>
        <p><b>Previous Hash:</b> <span class="hash-display">${block.previous_hash}</span></p>
        <p><b>Nonce:</b> ${block.nonce}</p>
        <p><b>Miner:</b> ${block.miner}</p>
        <p><b>Timestamp:</b> ${block.timestamp ? new Date(block.timestamp * 1000).toLocaleString() : 'N/A'}</p>
        <p><b>Mining Time:</b> ${block.mining_time ? block.mining_time.toFixed(2) + ' s' : 'N/A'}</p>
        <h4>Transactions (${block.transactions.length}):</h4>
        <ul>${block.transactions.map(tx =>
            `<li>From ${tx.sender_code || 'System'} to ${tx.recipient_code} : ${tx.amount ?? ''} SIM</li>`).join("")}
        </ul>
      </div>
    `;
    parent.innerHTML += html;
  }

  function displayTx(tx, parent) {
    let html = `
      <div class="search-result-block">
        <h4>Transaction</h4>
        <p><b>Sender:</b> ${tx.sender_code || 'System'}</p>
        <p><b>Recipient:</b> ${tx.recipient_code}</p>
        <p><b>Amount:</b> ${tx.amount} SIM</p>
        <p><b>Status:</b> ${tx.status || '-'}</p>
        <p><b>Time:</b> ${tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : "-"}</p>
      </div>
    `;
    parent.innerHTML += html;
  }
});
