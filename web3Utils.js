const Web3 = require("web3");
const Constants = require('./constants').Constants;
const abi = require('./abi/VotingContract.json').abi;

const getProvider = () => {
    try {
        // const web3 = new Web3.Web3("https://sepolia.infura.io/v3/8ee5212994f64e268c630ec7e48dff56");
        const web3 = new Web3.Web3("HTTP://127.0.0.1:7545");
        return web3;
    } catch (err) {
        console.log(err);
    }
}

const getContract = () => {
    const web3 = getProvider();
    return new web3.eth.Contract(abi, Constants.voteContractAddress);
}

const sendTransaction = async (method, params) => {
    const web3 = getProvider();
    const contract = getContract();
    const ownerAcc = web3.eth.accounts.privateKeyToAccount(Constants.ownerPrivate);
    try{
        const encodedABI = await contract.methods[method](...params).encodeABI();
        const estimatedGas = await contract.methods[method](...params).estimateGas({from: ownerAcc.address});
        const tx = await web3.eth.accounts.signTransaction({
            from: ownerAcc.address,
            to: Constants.voteContractAddress,
            gas: estimatedGas, 
            gasPrice: await web3.eth.getGasPrice(),
            data: encodedABI,
        }, Constants.ownerPrivate)

        return new Promise((resolve, reject) => {
            web3.eth.sendSignedTransaction(tx.rawTransaction)
            .on('receipt', receipt => {
                resolve(receipt);
            })
            .on('error', (err) => {
                reject(err)
            });
        })
    }catch (err) {
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

module.exports = { getProvider, setUploader, getContract, sendTransaction };