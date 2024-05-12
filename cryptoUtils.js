const crypto = require('crypto');
const Constants = require('./constants').Constants;
const StandardMerkleTree = require("@openzeppelin/merkle-tree").StandardMerkleTree;

const hash = (data) => {
    return crypto.createHash(Constants.hashAlgo).update(data).digest('hex');
}

const buildMerkleTree = (leaves) => {
    return StandardMerkleTree.of(leaves, ["address", "string"]);
}

const getMerkleProof = (address, tree) => {
    for (const [i, v] of tree.entries()) {
        if (v[0] === address) {
            return tree.getProof(i);
        }
    }
}

const verifyMerkleProof = (address, voteHash, proof, expectedRoot) => {
    return StandardMerkleTree.verify(expectedRoot, ['address', 'string'], [address, voteHash], proof);
}

module.exports = { hash, buildMerkleTree, getMerkleProof, verifyMerkleProof };