const crypto = require('crypto');
const Constants = require('./constants').Constants;

const hash = (data) => {
    return crypto.createHash(Constants.hashAlgo).update(data).digest('hex');
}

const buildMerkleTree = (leaves) => {
    let tree = [leaves];
    let currentLevel = leaves;

    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            if (i + 1 < currentLevel.length) {
                nextLevel.push(hash(currentLevel[i] + currentLevel[i + 1]));
            } else {
                nextLevel.push(currentLevel[i]);
            }
        }
        tree.push(nextLevel);
        currentLevel = nextLevel;
    }

    return tree;
}

const getMerkleProof = (index, tree) => {
    const proof = [];
    // Start at the last level before the root
    let currentLevel = tree.length - 2;

    while (currentLevel >= 0) {
        const pairIndex = (index % 2 === 0 ? index + 1 : index - 1);
        if (pairIndex < tree[currentLevel].length) {
            proof.push({ hash: tree[currentLevel][pairIndex], position: index % 2 === 0 ? 'right' : 'left' });
        }
        // Move to the next level up
        index = Math.floor(index / 2);
        currentLevel -= 1;
    }

    return proof;
}

const verifyMerkleProof = (voteHash, proof, expectedRoot) => {
    let currentHash = voteHash;
    for (const proofElement of proof) {
        if (proofElement.position === 'left') {
            currentHash = hash(proofElement.hash + currentHash);
        } else {
            currentHash = hash(currentHash + proofElement.hash);
        }
    }

    return currentHash === expectedRoot;
}

module.exports = { hash, buildMerkleTree, getMerkleProof, verifyMerkleProof };