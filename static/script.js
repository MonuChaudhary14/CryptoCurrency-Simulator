document.addEventListener("DOMContentLoaded", () => {
  // Tab elements and content panes
  const tabs = document.querySelectorAll(".tab-link");
  const panes = document.querySelectorAll(".tab-pane");

  // Username dropdown elements
  const dropdown = document.querySelector(".user-dropdown .dropdown-content");
  const dropbtn = document.querySelector(".user-dropdown .dropbtn");

  // Flash messages auto-hide
  document.querySelectorAll('.flash-message').forEach(flash => {
    setTimeout(() => {
      flash.classList.add('fade-out');
      setTimeout(() => flash.remove(), 500);
    }, 3000);
  });

  // Username dropdown toggle
  if (dropbtn && dropdown) {
    dropbtn.addEventListener('click', e => {
      e.stopPropagation();
      const expanded = dropbtn.getAttribute('aria-expanded') === 'true';
      dropbtn.setAttribute('aria-expanded', !expanded);
      const isHidden = dropdown.getAttribute('aria-hidden') === 'true';
      dropdown.setAttribute('aria-hidden', !isHidden);
      dropdown.classList.toggle('show');
    });

    // Hide dropdown on outside click
    document.addEventListener('click', () => {
      if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        dropbtn.setAttribute('aria-expanded', false);
        dropdown.setAttribute('aria-hidden', true);
      }
    });

    // Hide dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        dropbtn.setAttribute('aria-expanded', false);
        dropdown.setAttribute('aria-hidden', true);
        dropbtn.focus();
      }
    });
  }

  // Clear all active tabs and panes
  function clearActive() {
    tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
    });
    panes.forEach(p => {
      p.classList.remove('active');
      p.setAttribute('aria-hidden', 'true');
      p.setAttribute('tabindex', '-1');
    });
  }

  // Show selected tab and load data if needed
  async function showTab(tabID) {
    clearActive();
    const tab = document.querySelector(`.tab-link[data-tab="${tabID}"]`);
    const pane = document.getElementById(tabID);
    if (tab && pane) {
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      tab.setAttribute('tabindex', '0');
      tab.focus();
      pane.classList.add('active');
      pane.setAttribute('aria-hidden', 'false');
      pane.setAttribute('tabindex', '0');

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
        // No auto load for search and mine tabs
      }
    }
  }

  // Attach click events to tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      showTab(tab.dataset.tab);
    });
  });

  // Keyboard accessibility for tabs
  tabs.forEach(tab => {
    tab.addEventListener('keydown', e => {
      let index = Array.from(tabs).indexOf(tab);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        let next = tabs[(index + 1) % tabs.length];
        next.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        let prev = tabs[(index - 1 + tabs.length) % tabs.length];
        prev.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showTab(tab.dataset.tab);
      }
    });
  });

  // Initialize first active tab on page load
  const initialTab = document.querySelector(".tab-link.active");
  if (initialTab) showTab(initialTab.dataset.tab);

  // --- Fetch and display balances as a table ---
async function fetchBalances() {
    const container = document.getElementById('balanceList');
    if (!container) return;
    container.textContent = 'Loading balances...';
    try {
      const res = await fetch('/balances');
      if (!res.ok) throw new Error('Failed to load balances');
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


  // --- Fetch and display pending transactions ---
  async function fetchPendingTransactions() {
    const container = document.getElementById('pendingTxList');
    if (!container) return;
    container.textContent = 'Loading pending transactions...';
    try {
      const res = await fetch('/pending_transactions');
      if (!res.ok) throw new Error('Failed to load pending transactions');
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

  // --- Blockchain Explorer Visualization ---
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
        // Keyboard accessibility for Enter and Space
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
      // Fetch mining challenge metadata for animation
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
        // Fake hash for visual effect
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

      // Actual mining request (wait for completion)
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

  // Close mining modal
  window.closeMiningModal = function() {
    document.getElementById('miningModal').style.display = 'none';
  };

  // Simple sha256 for animation (fake hash)
  function sha256(str) {
    return Array(64).fill(0).map(() =>
      "0123456789abcdef"[Math.floor(Math.random() * 16)]
    ).join("");
  }

  // Attach mining button click
  document.querySelectorAll('.mine-btn').forEach(btn =>
    btn.addEventListener('click', window.mineBlock)
  );

  // --- Search functionality ---
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
        resultsDiv.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        resultsDiv.textContent = 'Search error.';
      }
    });
  }
});
