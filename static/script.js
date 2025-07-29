const tabs = document.querySelectorAll(".tab-link");
const panes = document.querySelectorAll(".tab-pane");

function clearTabs() {
  tabs.forEach(t => t.classList.remove("active"));
  panes.forEach(p => p.classList.remove("active"));
}

function showTab(tabId) {
  clearTabs();
  document.querySelector(`[data-tab='${tabId}']`).classList.add("active");
  document.getElementById(tabId).classList.add("active");
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    showTab(tab.dataset.tab);
    if (tab.dataset.tab === "balances") fetchBalances();
    if (tab.dataset.tab === "explorer") fetchBlockchain();
    if (tab.dataset.tab === "history") fetchTransactions();
  });
});

// -----------------------------
// Fetch Balances
// -----------------------------
async function fetchBalances() {
  try {
    const res = await fetch("/balances");
    const data = await res.json();
    const output = Object.entries(data)
      .map(([user, bal]) => `<p><strong>${user}</strong>: ${bal.toFixed(2)} SIM</p>`)
      .join("");
    document.getElementById("balanceList").innerHTML = output || "No balances yet.";
  } catch (e) {
    document.getElementById("balanceList").innerText = "Failed to load balances.";
  }
}

// -----------------------------
// Fetch Blockchain
// -----------------------------
async function fetchBlockchain() {
  try {
    const res = await fetch("/chain");
    const data = await res.json();
    const output = data
      .map(block => `
        <div class='block'>
          <p><strong>Block #${block.index}</strong></p>
          <p><strong>Hash:</strong> ${block.hash}</p>
          <p><strong>Prev:</strong> ${block.previous_hash}</p>
          <p><strong>Nonce:</strong> ${block.nonce}</p>
          <p><strong>Txns:</strong> ${block.transactions.length}</p>
        </div>
      `).join("<hr>");
    document.getElementById("blockchainView").innerHTML = output || "Blockchain is empty.";
  } catch (e) {
    document.getElementById("blockchainView").innerText = "Failed to load blockchain.";
  }
}

// -----------------------------
// Fetch Transaction History
// -----------------------------
async function fetchTransactions() {
  try {
    const res = await fetch("/transactions");
    const data = await res.json();
    const output = data
      .map(tx => `
        <p><strong>${tx.sender}</strong> → <strong>${tx.recipient}</strong>:
        ${tx.amount} SIM <small>(Block #${tx.block})</small></p>`
      ).join("");
    document.getElementById("transactionList").innerHTML = output || "No transactions yet.";
  } catch (e) {
    document.getElementById("transactionList").innerText = "Failed to load transactions.";
  }
}

// -----------------------------
// Auto Load Default Data
// -----------------------------
window.addEventListener("DOMContentLoaded", () => {
  fetchBalances();
  fetchBlockchain();
  fetchTransactions();
});
