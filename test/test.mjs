import {
    Worker,
    isMainThread,
    parentPort,
    workerData
} from "worker_threads";
import { getProvider } from '../web3Utils.js';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const threadCount = 10;
let accountCount = 0;
let accounts = [];
const accountVotes = [];
const cId = 6;
const batch = 500;

const initAccount = () => {
    return new Promise((resolve, reject) => {
        let tCount = 0;
        // try {
        //     if (isMainThread) {
        //         for (let i = 0; i < threadCount; i++) {
        //             const worker = new Worker(__filename, { workerData: accountCount / threadCount });
        //             worker.on('error', (err) => { throw err })
        //             worker.on('message', (acc) => {
        //                 accounts.push(acc);
        //                 process.stdout.clearLine();
        //                 process.stdout.cursorTo(0);
        //                 process.stdout.write(`Creacting accounts...... ${accounts.length}/${accountCount}`);
        //             });
        //             worker.on('exit', () => {
        //                 tCount++;
        //                 console.log(tCount)
        //                 console.log(threadCount);
        //                 if (tCount === threadCount) {
        //                     resolve();
        //                 }
        //             });
        //         }
        //     }
        //     else {
        //         const web3 = getProvider();
        //         const count = workerData;
        //         for (let i = 0; i < count; i++) {
        //             const acc = web3.eth.accounts.create()
        //             parentPort.postMessage(acc.privateKey);
        //         }
        //     } q
        // } catch (err) { reject(err) };
        // const web3 = getProvider();
        // for (let i = 0; i < accountCount; i++) {
        //     const acc = web3.eth.accounts.create();
        //     accounts.push(acc.address);
        //     process.stdout.clearLine();
        //     process.stdout.cursorTo(0);
        //     process.stdout.write(`Creacting accounts...... ${accounts.length}/${accountCount}`);
        // }


        const addressData = fs.readFileSync('address.txt', 'utf8');
        accounts = [...addressData.split(';').slice(0, 60000)]
        accountCount = accounts.length;
        console.log(accounts.length)
        // fs.writeFileSync('address.txt', accounts.join(';'));
        resolve();

    })
}

const vote = async (campaign, accs = null) => {
    let localAccs = [];
    if (accs === null) {
        localAccs = [...accounts.slice(0, batch)];
        accounts = [...accounts.slice(batch)];
    } else {
        localAccs = [...accs];
    }
    try {
        localAccs.forEach(acc => {
            accountVotes.push(1);
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Voting accounts...... ${accountVotes.length}/${accountCount}`);
            fetch('http://localhost:3000/cast', {
                method: 'post',
                body: JSON.stringify({
                    address: acc,
                    message: { option: campaign.options[Math.floor(campaign.options.length * Math.random())] },
                    campianId: cId
                }),
                agent: new http.Agent({ keepAlive: true }),
                headers: { 'Content-Type': 'application/json' }
            })
                .then(res => res.json())
                .then(res => {
                    // console.log(res);
                })
                .catch(err => console.log(err));
        })
        setTimeout(() => {
            if (accounts.length > 0) {
                let nextAccs = [...accounts.slice(0, batch)];
                accounts = [...accounts.slice(batch)];
                vote(campaign, nextAccs);
            }
        }, 400)
    } catch (err) {
        console.log(err)
    };
}

const test = async () => {
    const response = await fetch('http://localhost:3000/getCampaignResults', {
        method: 'post',
        body: JSON.stringify({ id: cId }),
        headers: { 'Content-Type': 'application/json' }
    });
    const campaign = await response.json();

    try {
        await initAccount();





        await vote(campaign);
    } catch (err) {
        console.log(err)
    }

}

test();

//generate account
