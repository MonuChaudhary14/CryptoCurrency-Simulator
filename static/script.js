document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-link");
  const panes = document.querySelectorAll(".tab-pane");
  const dropdown = document.querySelector(".user-dropdown .dropdown-content");
  const dropbtn = document.querySelector(".user-dropdown .dropbtn");

  // Utility to clear active classes
  function clearTabs() {
    tabs.forEach(t => t.classList.remove("active"));
    panes.forEach(p => p.classList.remove("active"));
  }

  // Show tab content and load dynamic content if needed
  function showTab(tabId) {
    clearTabs();
    const tab = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
    const pane = document.getElementById(tabId);
    if (tab && pane) {
      tab.classList.add("active");
      pane.classList.add("active");

      // Load tab-specific data
      if (tabId === "balances") {
        fetchBalances();
      } else if (tabId === "explorer") {
        fetchLatestBlock();
      } else if (tabId === "transactions") {
        fetchPendingTransactions();
      }
    }
  }

  // Attach tab click event listeners
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      showTab(tab.dataset.tab);
    });
  });

  // Show the initially active tab
  const activeTab = document.querySelector(".tab-link.active");
  if (activeTab) {
    showTab(activeTab.dataset.tab);
  }

  // Fetch balances API and display
  async function fetchBalances() {
    const balanceList = document.getElementById("balanceList");
    if (!balanceList) return;
    balanceList.textContent = "Loading balances...";
    try {
      const res = await fetch("/balances");
      if (!res.ok) throw new Error("Network response not ok");
      const data = await res.json();
      let html = "<ul>";
      for (const [code, balance] of Object.entries(data)) {
        html += `<li><strong>${code}</strong>: ${balance.toFixed(2)} SIM</li>`;
      }
      html += "</ul>";
      balanceList.innerHTML = html;
    } catch {
      balanceList.textContent = "Failed to load balances.";
    }
  }

  // Fetch latest block API and display
  async function fetchLatestBlock() {
    const blockDiv = document.getElementById("latestBlock");
    if (!blockDiv) return;
    blockDiv.textContent = "Loading latest block...";
    try {
      const res = await fetch("/chain");
      if (!res.ok) throw new Error("Network response not ok");
      const chain = await res.json();
      if (chain.length === 0) {
        blockDiv.textContent = "No blocks mined yet.";
        return;
      }
      const block = chain[chain.length - 1];
      let html = `<p><strong>Block #${block.index}</strong></p>`;
      html += `<p><b>Hash:</b> ${block.hash}</p>`;
      html += `<p><b>Previous Hash:</b> ${block.previous_hash}</p>`;
      html += `<p><b>Nonce:</b> ${block.nonce}</p>`;
      html += "<p><b>Transactions:</b></p><ul>";
      if (block.transactions && block.transactions.length > 0) {
        block.transactions.forEach(tx => {
          html += `<li>From <strong>${tx.sender_code}</strong> to <strong>${tx.recipient_code}</strong>: ${tx.amount.toFixed(2)} SIM</li>`;
        });
      } else {
        html += "<li>No transactions in this block.</li>";
      }
      html += "</ul>";
      blockDiv.innerHTML = html;
    } catch {
      blockDiv.textContent = "Failed to load block data.";
    }
  }

  // Fetch pending transactions API and display
  async function fetchPendingTransactions() {
    const txnDiv = document.getElementById("transactionList");
    if (!txnDiv) return;
    txnDiv.textContent = "Loading pending transactions...";
    try {
      const res = await fetch("/pending_transactions");
      if (!res.ok) throw new Error("Network response not ok");
      const txns = await res.json();
      if (txns.length === 0) {
        txnDiv.textContent = "No pending transactions.";
        return;
      }
      let html = "<ul>";
      txns.forEach(tx => {
        html += `<li>From <strong>${tx.sender_code}</strong> to <strong>${tx.recipient_code}</strong>: ${tx.amount.toFixed(2)} SIM</li>`;
      });
      html += "</ul>";
      txnDiv.innerHTML = html;
    } catch {
      txnDiv.textContent = "Failed to load transactions.";
    }
  }

  // Toggle dropdown visibility in a controlled way using a CSS class for better style management
  function toggleDropdown() {
    if (!dropdown) return;
    dropdown.classList.toggle("show");
  }

  // Hide dropdown
  function closeDropdown() {
    if (!dropdown) return;
    dropdown.classList.remove("show");
  }

  // Toggle dropdown on button click
  if (dropbtn) {
    dropbtn.addEventListener("click", e => {
      e.stopPropagation();
      toggleDropdown();
    });
  }

  // Close dropdown if clicking outside
  document.addEventListener("click", e => {
    if (!dropdown || !dropbtn) return;
    if (!dropbtn.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
  });

  // (Optional) Close dropdown if Escape key pressed while dropdown is visible
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeDropdown();
    }
  });
});
