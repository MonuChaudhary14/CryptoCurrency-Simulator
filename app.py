from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import uuid
import hashlib
import json
import time
from pymongo import MongoClient

app = Flask(__name__)
app.secret_key = 'your-secret-key'  # Change this to a strong secret key

# --- Database Setup ---
client = MongoClient("mongodb://localhost:27017")
db = client['cryptosim_db']
users = db['users']
blockchain = db['blockchain']
pending_transactions = db['pending_transactions']

DIFFICULTY = 4  # Mining difficulty: how many leading zeroes required in block hash

# --- Helper Functions ---

def hash_password(password):
    """Hash a password with SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()

def get_user_by_username(username):
    """Retrieve user document by username."""
    return users.find_one({"username": username})

def get_user_by_code(code):
    """Retrieve user document by unique code."""
    return users.find_one({"unique_code": code})

def get_last_block():
    """Get the latest block in the blockchain; create genesis block if empty."""
    block = blockchain.find_one(sort=[("index", -1)])
    if block:
        return block
    else:
        genesis = {
            'index': 0,
            'hash': '0'*64,
            'previous_hash': '0'*64,
            'nonce': 0,
            'transactions': [],
            'timestamp': time.time(),
            'mining_time': 0,
            'miner': 'system'
        }
        blockchain.insert_one(genesis)
        return genesis

def proof_of_work(index, previous_hash, transactions):
    """Performs proof-of-work algorithm."""
    nonce = 0
    start_time = time.time()
    tx_string = json.dumps(transactions, sort_keys=True)
    while True:
        block_string = f"{index}{previous_hash}{nonce}{tx_string}"
        block_hash = hashlib.sha256(block_string.encode()).hexdigest()
        if block_hash.startswith('0' * DIFFICULTY):
            mining_time = time.time() - start_time
            return nonce, block_hash, mining_time
        nonce += 1

def get_user_balance(user_code):
    """Get user's balance, accounting for pending outgoing transactions."""
    user = get_user_by_code(user_code)
    if not user:
        return 0
    pending_amount = sum(
        tx['amount'] for tx in pending_transactions.find({'sender_code': user_code, 'status': 'pending'})
    )
    return user.get('balance', 0) - pending_amount

# --- Simple login_required decorator ---

def login_required(func):
    def wrapper(*args, **kwargs):
        if 'username' not in session:
            flash("Please login first.")
            return redirect(url_for('login'))
        return func(*args, **kwargs)
    wrapper.__name__ = func.__name__  # preserve original function name for Flask
    return wrapper

# --- Flask Routes ---

@app.route('/')
def index():
    username = session.get('username')
    user_list = list(users.find({}, {"_id": 0, "password_hash": 0, "tx_password_hash": 0}))
    users_dict = {u['username']: u for u in user_list}
    return render_template('index.html', username=username, users=users_dict)

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirmPassword', '')
        tx_password = request.form.get('tx_password', '')

        if not all([username, email, password, confirm_password, tx_password]):
            flash("All fields are required!")
            return redirect(url_for('signup'))

        if password != confirm_password:
            flash("Passwords do not match!")
            return redirect(url_for('signup'))

        if get_user_by_username(username):
            flash("Username already exists!")
            return redirect(url_for('signup'))

        unique_code = str(uuid.uuid4())[:8]
        user_doc = {
            "username": username,
            "email": email,
            "password_hash": hash_password(password),
            "tx_password_hash": hash_password(tx_password),
            "unique_code": unique_code,
            "balance": 50.0,  # Initial balance
            "created_at": time.time()
        }
        users.insert_one(user_doc)
        flash(f"Account created! Your unique code is: {unique_code}")
        return redirect(url_for('login'))
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        user = get_user_by_username(username)
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
    sender_username = session['username']
    sender = get_user_by_username(sender_username)

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

    if hash_password(tx_password) != sender.get('tx_password_hash', ''):
        flash("Incorrect transaction password.")
        return redirect(url_for('index'))

    recipient = get_user_by_code(recipient_code)
    if not recipient:
        flash("Recipient unique code not found.")
        return redirect(url_for('index'))

    available_balance = get_user_balance(sender['unique_code'])
    if available_balance < amount:
        flash("Insufficient funds considering pending transactions.")
        return redirect(url_for('index'))

    # Insert new pending transaction
    pending_transactions.insert_one({
        'sender_code': sender['unique_code'],
        'recipient_code': recipient_code,
        'amount': amount,
        'timestamp': time.time(),
        'status': 'pending'
    })

    flash("Transaction added to pending list.")
    return redirect(url_for('index'))

@app.route('/profile')
@login_required
def profile():
    username = session['username']
    user = get_user_by_username(username)
    if not user:
        flash("User not found.")
        return redirect(url_for('index'))

    code = user['unique_code']

    pending = list(pending_transactions.find({'sender_code': code, 'status': 'pending'}, {'_id': 0}))
    confirmed = list(pending_transactions.find({'sender_code': code, 'status': 'confirmed'}, {'_id': 0}))
    available_balance = get_user_balance(code)

    return render_template('profile.html',
                           username=username,
                           name=user.get('email', ''),
                           unique_code=code,
                           balance=user.get('balance', 0),
                           available_balance=available_balance,
                           join_date=time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(user.get('created_at', 0))),
                           pending_txs=pending,
                           confirmed_txs=confirmed)

@app.route('/mine', methods=['POST'])
@login_required
def mine():
    miner_username = session['username']
    miner_user = get_user_by_username(miner_username)

    pending_txs_list = list(pending_transactions.find({'status': 'pending'}))
    if not pending_txs_list:
        flash("No pending transactions to mine.")
        return redirect(url_for('index'))

    valid_txs = []
    for tx in pending_txs_list:
        sender = get_user_by_code(tx['sender_code'])
        recipient = get_user_by_code(tx['recipient_code'])
        if sender and recipient and sender['balance'] >= tx['amount']:
            valid_txs.append(tx)

    if not valid_txs:
        flash("No valid transactions to mine.")
        return redirect(url_for('index'))

    last_block = get_last_block()
    new_index = last_block['index'] + 1

    tx_list = [{k: v for k, v in tx.items() if k != '_id'} for tx in valid_txs]

    nonce, hash_result, mining_time = proof_of_work(new_index, last_block['hash'], tx_list)

    # Update balances and transaction status
    for tx in valid_txs:
        users.update_one({'unique_code': tx['sender_code']}, {'$inc': {'balance': -tx['amount']}})
        users.update_one({'unique_code': tx['recipient_code']}, {'$inc': {'balance': tx['amount']}})
        pending_transactions.update_one({'_id': tx['_id']}, {'$set': {'status': 'confirmed'}})

    # Reward miner with 10 SIM coins
    users.update_one({'username': miner_username}, {'$inc': {'balance': 10}})

    new_block = {
        'index': new_index,
        'hash': hash_result,
        'previous_hash': last_block['hash'],
        'nonce': nonce,
        'transactions': tx_list,
        'timestamp': time.time(),
        'mining_time': mining_time,
        'miner': miner_username
    }

    blockchain.insert_one(new_block)

    flash(f"Block mined! You earned 10 SIM. Nonce: {nonce}, Time: {mining_time:.2f}s")

    return jsonify({
        'success': True,
        'index': new_index,
        'nonce': nonce,
        'hash': hash_result,
        'mining_time': mining_time
    })

@app.route('/mine_progress', methods=['GET'])
@login_required
def mine_progress():
    miner_username = session['username']

    pending_txs_list = list(pending_transactions.find({'status': 'pending'}))
    if not pending_txs_list:
        return jsonify({'error': 'No pending transactions to mine'})

    valid_txs = []
    for tx in pending_txs_list:
        sender = get_user_by_code(tx['sender_code'])
        recipient = get_user_by_code(tx['recipient_code'])
        if sender and recipient and sender['balance'] >= tx['amount']:
            valid_txs.append(tx)

    if not valid_txs:
        return jsonify({'error': 'No valid transactions to mine'})

    last_block = get_last_block()
    new_index = last_block['index'] + 1
    tx_count = len(valid_txs)

    return jsonify({
        'index': new_index,
        'previous_hash': last_block['hash'],
        'transactions': tx_count,
        'difficulty': DIFFICULTY
    })

@app.route('/balances')
@login_required
def balances_api():
    all_users = users.find({}, {"_id": 0, "unique_code": 1, "balance": 1})
    result = {u['unique_code']: u['balance'] for u in all_users}
    return jsonify(result)

@app.route('/chain')
@login_required
def chain_api():
    blocks = list(blockchain.find({}, {"_id": 0}).sort("index", 1))
    return jsonify(blocks)

@app.route('/pending_transactions')
@login_required
def pending_transactions_api():
    txs = list(pending_transactions.find({'status': 'pending'}, {"_id": 0}))
    return jsonify(txs)


@app.route('/block/<int:block_index>')
@login_required
def get_block_details(block_index):
    block = blockchain.find_one({'index': block_index}, {'_id': 0})
    if block:
        return jsonify(block)
    return jsonify({'error': 'Block not found'}), 404


@app.route('/history')
@login_required
def history_api():
    code = get_user_by_username(session['username'])['unique_code']
    pending = list(pending_transactions.find({'sender_code': code, 'status': 'pending'}, {'_id': 0}))
    confirmed = list(pending_transactions.find({'sender_code': code, 'status': 'confirmed'}, {'_id': 0}))
    return jsonify({'pending': pending, 'confirmed': confirmed})

@app.route('/search_transactions')
@login_required
def search_transactions():
    q = request.args.get('q', '').strip()
    my_code = get_user_by_username(session['username'])['unique_code']

    # Block search by index
    if q.isdigit():
        block = blockchain.find_one({"index": int(q)}, {"_id": 0})
        if block:
            return jsonify({'block': block})

    # Block search by full 64-char hash
    if len(q) == 64 and all(c in "0123456789abcdefABCDEF" for c in q):
        block = blockchain.find_one({"hash": q}, {"_id": 0})
        if block:
            return jsonify({'block': block})

    # Transaction search (sender or recipient matches, or amount if numeric)
    or_conditions = [
        {'sender_code': {'$regex': q, '$options': 'i'}},
        {'recipient_code': {'$regex': q, '$options': 'i'}}
    ]
    try:
        num_val = float(q)
        or_conditions.append({'amount': num_val})
    except ValueError:
        pass

    query = {
        '$and': [
            {'$or': [
                {'sender_code': my_code},
                {'recipient_code': my_code}
            ]},
            {'$or': or_conditions}
        ]
    }

    results = list(pending_transactions.find(query, {'_id': 0}))
    return jsonify({'transactions': results})

# --- Main ---

if __name__ == '__main__':
    app.run(debug=True)
