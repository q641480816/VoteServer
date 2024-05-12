const Web3 = require("web3");
const { hsetMassGet, hsetAdd } = require("./redisClient");
const Constants = require('./constants').Constants;
const abi = require('./abi/VotingContract.json').abi;
const cluster = require('cluster');

let web3bust = null;

const getProvider = () => {
    try {
        // const web3 = new Web3.Web3("https://sepolia.infura.io/v3/8ee5212994f64e268c630ec7e48dff56");
        if (!web3bust) {
            web3bust = new Web3.Web3("HTTP://127.0.0.1:7545");
        }
        return web3bust;
    } catch (err) {
        console.log(err);
    }
}

const getContract = () => {
    const web3 = getProvider();
    return new web3.eth.Contract(abi, Constants.voteContractAddress);
}

const verifySignedMessage = async (address, message, sig) => {
    const web3 = getProvider();
    const msgBufferHex = web3.utils.utf8ToHex(message);
    const messageHash = web3.utils.keccak256(msgBufferHex);
    const signingAddress = await web3.eth.accounts.recover(messageHash, sig);

    return address.toLowerCase() === signingAddress.toLowerCase();
}

const getAvaliableUploader = () => {
    const uploaderTable = 'uploader';
    const mainCluster = () => {
        return new Promise((resolve, reject) => {
            hsetMassGet(uploaderTable, ...Constants.uploader)
                .then(uploader => {
                    let isFound = false;
                    for (let i = 0; i < uploader.length; i++) {
                        if (uploader[i] === 'true') {
                            console.log(uploader);
                            isFound = true;
                            hsetAdd(uploaderTable, Constants.uploader[i], false)
                                .then(res => resolve(Constants.uploader[i]))
                                .catch(err => reject(err));
                            break;
                        }
                    }
                    if (!isFound) {
                        console.log('All uploader are busy... calling again in 500 milliseconds');
                        setTimeout(() => {
                            getAvaliableUploader()
                                .then(pk => resolve(pk))
                                .catch(err => reject(err));
                        }, 500);
                    }
                })
                .catch(err => reject(err));
        })
    }

    return new Promise((resolve, reject) => {
        if (cluster.isPrimary) {
            mainCluster()
                .then(pk => resolve(pk))
                .catch(err => reject(err))
        } else {
            const uniqueId = Date.now() + Math.random();
            const requestHandler = (msg) => {
                if (msg.id === uniqueId) {
                    process.off('message', requestHandler);
                    if (msg.type === 'error') {
                        reject(msg.error);
                    } else if (msg.type === 'response') {
                        resolve(msg.data);
                    }
                }
            }

            process.on('message', requestHandler);
            process.send({ type: 'request', id: uniqueId, data: 'getAvaliableUploader' });
        }
    })
}

const sendTransaction = async (method, params) => {
    const uploaderTable = 'uploader';
    const uploaderPk = await getAvaliableUploader();

    try {
        const web3 = getProvider();
        const uploader = web3.eth.accounts.privateKeyToAccount(uploaderPk);
        const contract = getContract();

        const encodedABI = await contract.methods[method](...params).encodeABI();
        const estimatedGas = await contract.methods[method](...params).estimateGas({ from: uploader.address });
        const tx = await web3.eth.accounts.signTransaction({
            from: uploader.address,
            to: Constants.voteContractAddress,
            gas: estimatedGas * 2n,
            gasPrice: await web3.eth.getGasPrice(),
            data: encodedABI,
            nonce: await web3.eth.getTransactionCount(uploader.address, 'latest')
        }, uploaderPk)

        return new Promise((resolve, reject) => {
            try {
                const confirmationListener = (confirmation) => {
                    hsetAdd(uploaderTable, uploaderPk, true)
                    console.log('Uploader released');
                    transaction.off('confirmation', confirmationListener);
                };

                const receiptListener = (receipt) => {
                    resolve(receipt);
                    transaction.off('receipt', receiptListener);
                };

                const errorListener = (err) => {
                    hsetAdd(uploaderTable, uploaderPk, true)
                    console.log('Uploader released');
                    reject(err)
                    transaction.off('error', errorListener);
                };

                const transaction = web3.eth.sendSignedTransaction(tx.rawTransaction);
                transaction.on('receipt', receiptListener)
                transaction.on('confirmation', confirmationListener)
                transaction.on('error', errorListener);
            } catch (err) {
                hsetAdd(uploaderTable, uploaderPk, true)
                console.log('Uploader released');
                reject(err)
            }
        })
    } catch (err) {
        console.log(err)
        throw err;
    }
}

const setUploader = async (address) => {

    try {

        // console.log(tx);

    } catch (err) {
        throw err;
    }
}

module.exports = { getProvider, setUploader, verifySignedMessage, getContract, sendTransaction, getAvaliableUploader };