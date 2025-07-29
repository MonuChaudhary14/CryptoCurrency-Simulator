from flask import Flask, request, render_template, redirect, url_for, jsonify
from flask_pymongo import PyMongo
import json
import time
from hashlib import sha256
from uuid import uuid4
from collections import defaultdict

app = Flask(__name__)
app.config["MONGO_URI"] = "mongodb://localhost:27017/blockchain_db"
mongo = PyMongo(app)

# ------------------------
# Blockchain Components
# ------------------------
class Block:
    def __init__(self, index, timestamp, transactions, previous_hash, nonce=0):
        self.index = index
        self.timestamp = timestamp
        self.transactions = transactions
        self.previous_hash = previous_hash
        self.nonce = nonce
        self.hash = self.compute_hash()

    def compute_hash(self):
        block_string = json.dumps(self.__dict__, sort_keys=True)
        return sha256(block_string.encode()).hexdigest()

class Blockchain:
    def __init__(self):
        self.chain = []
        self.current_transactions = []
        self.difficulty = 3
        self.balances = defaultdict(float)
        self.create_genesis_block()

    def create_genesis_block(self):
        genesis_block = Block(0, time.time(), [], "0")
        self.chain.append(genesis_block)

    def get_last_block(self):
        return self.chain[-1]

    def add_transaction(self, sender, recipient, amount):
        amount = float(amount)
        if sender != "MINER" and self.balances[sender] < amount:
            return False

        txn = {
            'sender': sender,
            'recipient': recipient,
            'amount': amount,
            'timestamp': time.time()
        }

        self.current_transactions.append(txn)

        mongo.db.transactions.insert_one({
            **txn,
            'status': 'pending'
        })

        if sender != "MINER":
            self.balances[sender] -= amount
        self.balances[recipient] += amount
        return True

    def proof_of_work(self, block):
        block.nonce = 0
        block.hash = block.compute_hash()
        while not block.hash.startswith('0' * self.difficulty):
            block.nonce += 1
            block.hash = block.compute_hash()
        return block.hash

    def mine_block(self, miner):
        if not self.current_transactions:
            return None
        self.add_transaction("MINER", miner, 10.0)
        last_block = self.get_last_block()
        new_block = Block(index=last_block.index + 1,
                          timestamp=time.time(),
                          transactions=self.current_transactions[:],
                          previous_hash=last_block.hash)
        new_block.hash = self.proof_of_work(new_block)
        self.chain.append(new_block)

        for txn in new_block.transactions:
            mongo.db.transactions.update_many(
                {
                    'sender': txn['sender'],
                    'recipient': txn['recipient'],
                    'timestamp': txn['timestamp']
                },
                {
                    '$set': {
                        'status': 'confirmed',
                        'block_index': new_block.index
                    }
                }
            )

        # Save block to MongoDB
        mongo.db.blocks.insert_one(new_block.__dict__)
        self.current_transactions = []

        return new_block

    def to_dict(self):
        return [block.__dict__ for block in self.chain]

    def get_transaction_history(self):
        history = list(mongo.db.transactions.find({}, {"_id": 0}))
        return history

# ------------------------
# App Initialization
# ------------------------
blockchain = Blockchain()
blockchain.balances['alice'] = 50
blockchain.balances['bob'] = 30
blockchain.balances['carol'] = 20
node_id = str(uuid4()).replace('-', '')

# ------------------------
# Flask Routes
# ------------------------
@app.route('/')
def index():
    return render_template('index.html', balances=blockchain.balances)

@app.route('/send', methods=['POST'])
def send():
    sender = request.form['sender']
    recipient = request.form['recipient']
    amount = request.form['amount']
    success = blockchain.add_transaction(sender, recipient, amount)
    if not success:
        return "Insufficient funds!", 400
    return redirect(url_for('index'))

@app.route('/mine', methods=['POST'])
def mine():
    miner = request.form['miner']
    new_block = blockchain.mine_block(miner)
    if not new_block:
        return "Nothing to mine!"
    return redirect(url_for('index'))

@app.route('/chain')
def get_chain():
    return jsonify(blockchain.to_dict())

@app.route('/balances')
def get_balances():
    return jsonify(blockchain.balances)

@app.route('/transactions')
def get_transactions():
    return jsonify(blockchain.get_transaction_history())

@app.route('/api/send', methods=['POST'])
def api_send():
    data = request.get_json()
    if not all(k in data for k in ('sender', 'recipient', 'amount')):
        return jsonify({"error": "Missing fields"}), 400
    success = blockchain.add_transaction(data['sender'], data['recipient'], data['amount'])
    if not success:
        return jsonify({"error": "Insufficient balance"}), 400
    return jsonify({"message": "Transaction added"}), 201

@app.route('/api/mine', methods=['POST'])
def api_mine():
    data = request.get_json()
    if 'miner' not in data:
        return jsonify({"error": "Miner address required"}), 400
    block = blockchain.mine_block(data['miner'])
    if not block:
        return jsonify({"error": "No transactions to mine"}), 400
    return jsonify(block.__dict__), 201

if __name__ == '__main__':
    app.run(debug=True)