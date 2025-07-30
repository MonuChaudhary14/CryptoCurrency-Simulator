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



document.addEventListener('click', function (e) {
  const dropdown = document.querySelector('.user-dropdown .dropdown-content');
  const button = document.querySelector('.dropbtn');
  if (button.contains(e.target)) {
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
  } else {
    dropdown.style.display = 'none';
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const authSection = document.getElementById("auth-section");

  // Simulate login status with localStorage
  const isLoggedIn = localStorage.getItem("loggedIn") === "true";

  if (authSection) {
    if (isLoggedIn) {
      authSection.innerHTML = `
        <div class="user-dropdown">
          <button class="dropbtn">👤 Account ▾</button>
          <div class="dropdown-content">
            <a href="/profile">My Profile</a>
            <form action="/logout" method="POST" style="margin: 0;">
              <button type="submit" class="logout-btn">Logout</button>
            </form>
          </div>
        </div>
      `;
    } else {
      authSection.innerHTML = `
        <div class="auth-links">
          <div class = "login-dashboard"><a href="Login.html" >Login</a></div>
          <div class = "signup-dashboard"><a href="Signup.html" >Sign Up</a></div>
        </div>
      `;
    }
  }
});


  // Optional: Handle tab switching
  document.querySelectorAll(".tab-link").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab-link").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });


