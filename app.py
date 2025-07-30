from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import uuid
import hashlib
import json
from functools import wraps
from pymongo import MongoClient

app = Flask(__name__)
app.secret_key = 'your-secret-key'

# MongoDB config
MONGO_URI = "mongodb://localhost:27017"
client = MongoClient(MONGO_URI)
db = client['cryptosim_db']

# Collections for users, blockchain, pending_transactions
users_col = db['users']
blockchain_col = db['blockchain']
pending_tx_col = db['pending_transactions']

DIFFICULTY = 4  # Number of leading zeros required in hash

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            flash("Please login first.")
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def find_user(username):
    return users_col.find_one({"username": username})

def find_user_by_code(unique_code):
    return users_col.find_one({"unique_code": unique_code})

def get_last_block():
    block = blockchain_col.find_one(sort=[("index", -1)])
    if block:
        return block
    else:
        # Genesis block if none exist
        genesis_block = {
            'index': 0,
            'hash': '0' * 64,
            'previous_hash': '0' * 64,
            'nonce': 0,
            'transactions': []
        }
        blockchain_col.insert_one(genesis_block)
        return genesis_block

def proof_of_work(index, last_hash, transactions):
    nonce = 0
    transactions_str = json.dumps(transactions, sort_keys=True)
    while True:
        block_string = f"{index}{last_hash}{nonce}{transactions_str}"
        block_hash = hashlib.sha256(block_string.encode()).hexdigest()
        if block_hash.startswith('0' * DIFFICULTY):
            return nonce, block_hash
        nonce += 1

@app.route('/')
def index():
    username = session.get('username')
    # Load all users for display (hide sensitive data)
    users_cursor = users_col.find({}, {"_id":0, "password_hash":0, "tx_password_hash":0})
    users = {u['username']: u for u in users_cursor}
    return render_template('index.html', username=username, users=users)

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirmPassword', '')
        tx_password = request.form.get('tx_password', '')

        if not all([username, email, password, confirm_password, tx_password]):
            flash("All fields are required")
            return redirect(url_for('signup'))

        if password != confirm_password:
            flash("Passwords do not match")
            return redirect(url_for('signup'))

        if find_user(username):
            flash("Username already exists")
            return redirect(url_for('signup'))

        unique_code = str(uuid.uuid4())[:8]
        user_doc = {
            "username": username,
            "email": email,
            "password_hash": hash_password(password),
            "tx_password_hash": hash_password(tx_password),
            "unique_code": unique_code,
            "balance": 50.0
        }
        users_col.insert_one(user_doc)

        flash(f"Account created! Your unique code is: {unique_code}")
        return redirect(url_for('login'))

    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        user = find_user(username)
        if user and hash_password(password) == user['password_hash']:
            session['username'] = username
            flash("Logged in successfully.")
            return redirect(url_for('index'))
        else:
            flash("Invalid username or password.")
            return redirect(url_for('login'))
    return render_template('login.html')

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    session.pop('username', None)
    flash("Logged out.")
    return redirect(url_for('index'))

@app.route('/send', methods=['POST'])
@login_required
def send():
    sender = session['username']
    user = find_user(sender)
    recipient_code = request.form.get('recipient_code', '').strip()
    amount_str = request.form.get('amount', '')
    tx_password = request.form.get('tx_password', '')

    if not recipient_code or not amount_str or not tx_password:
        flash("All fields are required for transaction.")
        return redirect(url_for('index'))

    try:
        amount = float(amount_str)
        if amount <= 0:
            flash("Amount must be positive.")
            return redirect(url_for('index'))
    except ValueError:
        flash("Invalid amount.")
        return redirect(url_for('index'))

    if hash_password(tx_password) != user['tx_password_hash']:
        flash("Incorrect transaction password.")
        return redirect(url_for('index'))

    recipient = find_user_by_code(recipient_code)
    if not recipient:
        flash("Recipient unique code not found.")
        return redirect(url_for('index'))

    if user['balance'] < amount:
        flash("Insufficient balance.")
        return redirect(url_for('index'))

    # Insert transaction to pending transactions collection
    pending_tx_col.insert_one({
        'sender_code': user['unique_code'],
        'recipient_code': recipient_code,
        'amount': amount
    })

    flash("Transaction added to pending list.")
    return redirect(url_for('index'))

@app.route('/profile')
@login_required
def profile():
    username = session['username']
    user = find_user(username)

    # If you want to add Name separately during signup, you can store/retrieve it here.
    # For now, let's use 'email' field as Name if you prefer.
    name = user.get('email', '')

    return render_template('profile.html', username=username, name=name, unique_code=user['unique_code'])


@app.route('/mine', methods=['POST'])
@login_required
def mine():
    miner = session['username']
    user = find_user(miner)
    
    # Load all pending transactions
    pending_txs = list(pending_tx_col.find({}))
    
    # Validate all pending transactions (skip invalid)
    valid_transactions = []
    for tx in pending_txs:
        sender = users_col.find_one({'unique_code': tx['sender_code']})
        recipient = users_col.find_one({'unique_code': tx['recipient_code']})
        if sender and recipient and sender['balance'] >= tx['amount']:
            valid_transactions.append(tx)
    
    # Atomically apply transactions and update user balances
    for tx in valid_transactions:
        users_col.update_one({'unique_code': tx['sender_code']}, {'$inc': {'balance': -tx['amount']}})
        users_col.update_one({'unique_code': tx['recipient_code']}, {'$inc': {'balance': tx['amount']}})

    # Mining reward: add 10 SIM to miner
    users_col.update_one({'username': miner}, {'$inc': {'balance': 10}})

    last_block = get_last_block()
    index = last_block['index'] + 1
    # Convert transactions to dicts without ObjectId for storage in block
    tx_list = [{k: v for k, v in tx.items() if k != '_id'} for tx in valid_transactions]

    nonce, block_hash = proof_of_work(index, last_block['hash'], tx_list)

    new_block = {
        'index': index,
        'hash': block_hash,
        'previous_hash': last_block['hash'],
        'nonce': nonce,
        'transactions': tx_list
    }

    blockchain_col.insert_one(new_block)

    # Remove confirmed valid transactions from pending collection
    for tx in valid_transactions:
        pending_tx_col.delete_one({'_id': tx['_id']})

    flash(f"Block mined! You earned 10 SIM. Proof of Work nonce: {nonce}")
    return redirect(url_for('index'))

# API routes to fetch data from DB

@app.route('/balances')
@login_required
def balances_api():
    # Return balances as JSON mapping unique_code: balance
    users_cursor = users_col.find({}, {"_id":0, "unique_code":1, "balance":1})
    result = {}
    for u in users_cursor:
        result[u['unique_code']] = u['balance']
    return jsonify(result)

@app.route('/chain')
@login_required
def chain_api():
    blocks = list(blockchain_col.find({}, {"_id":0}).sort("index", 1))
    return jsonify(blocks)

@app.route('/pending_transactions')
@login_required
def pending_transactions_api():
    txs = list(pending_tx_col.find({}, {"_id":0}))
    return jsonify(txs)

@app.route('/transactions')
@login_required
def transactions():
    username = session['username']
    pending_txs = list(pending_tx_col.find({}))
    users_cursor = users_col.find({}, {"_id":0, "username":1, "unique_code":1})
    users_map = {u['username']: u for u in users_cursor}
    return render_template('transactions.html', username=username, users=users_map, pending_transactions=pending_txs)

if __name__ == '__main__':
    app.run(debug=True)
