const { parentPort, workerData } = require('worker_threads');
const { getProvider } = require('../web3Utils');

console.log(workerData)
for(let i = 0 ; i < workerData.count; i ++){
    parentPort.postMessage(web3.eth.accounts.create());
}