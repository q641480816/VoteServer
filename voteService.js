const redis = require('./redisClient');
const Constants = require('./constants').Constants;
const cryptoUtils = require('./cryptoUtils');
const { getProvider, setUploader, sendTransaction, getContract } = require('./web3Utils');

const sampleCampaign = {
    name: 'Sample Campaign',
    options: ['A', 'B', 'C', 'D']
}

const validateContract = async () => {
    try {
        const web3 = getProvider();
        const block = await web3.eth.getChainId();
        console.log(block);
    } catch (err) {
        console.log(err);
    }
}

const setUploaderWithAddress = async (addr) => {
    const logger = require('./logger');
    try {
        const receipt = await sendTransaction("setUploader", [addr, true]);
        logger.info(`${addr} has been set yo uploader.`);
    } catch (err) {
        logger.error(`Failed to set uploader: ${err.message}`);
    }
}

const getCampaignResults = async (id) => {
    let contract = getContract();
    const campaign = await contract.methods.getCampaignResults(id).call();
    return campaign;
}

const startCampaign = async (name, options) => {
    const logger = require('./logger');
    try {
        const receipt = await sendTransaction("beginVoteCampaign", [name, options]);
        logger.info(`Campain ${name}: ${JSON.stringify(options)} has been started and broadcasted on chain.`);
        return "Started";
    } catch (err) {
        throw err;
    }

    //assume we have the id now
    // 
    //     const id = 1;
    //     const hkey = `${id}pending`;
    //     const skey = `${id}pendingVoted`;

    //     await redis.hsetAdd(hkey, 'temp', 'temp');
    //     await redis.hsetDelete(hkey, 'temp');
    //     await redis.setAdd(skey, 'temp');
    //     await redis.setRemove(skey, 'temp');
    //     logger.info(`Campaign ${name} has been updated to redis`);
    //     return id;

}

const endCampaign = async (campaignId) => {
    const logger = require('./logger');
    try {
        const receipt = await sendTransaction("endVoteCampaign", [campaignId]);
        logger.info(`CampainId ${campaignId}: Ended on chain`);
        return "Ended";
    } catch (err) {
        throw err;
    }
}

const castVote = async (address, message, campaignId) => {
    const logger = require('./logger');
    //TODO: verify message with wallet public key and retrieve message
    const hkey = `${campaignId}pending`;
    const skey = `${campaignId}pendingVoted`;

    try {
        //check if user's vote is valid
        const isMember = await redis.sismember(skey, address);
        if (isMember === 1) throw Error(`Address ${address} has already voted for campaignId: ${campaignId}`);
        const campaign = await getCampaignResults(campaignId);
        // console.log(campaign)
        if (!campaign[3]) throw Error(`Campaign [${campaignId}] ${campaign[0]} is not active!`);
        if (campaign[1].indexOf(message.option) < 0) throw Error(`User vote [${message.option}] is not valid Options! Valid options: [${campaign[1].join(', ')}].`);

        //add user to pending pool
        await redis.hsetAdd(hkey, address, message.option);
        await redis.setAdd(skey, address);
        logger.info(`Address ${address} has been added to pending pool of campaignId: ${campaignId} with option: ${message.option}`);

        const pendingCount = await redis.hsetCount(hkey);
        if (pendingCount >= Constants.threshold) {
            logger.info(`CampaignId: ${campaignId} has hit the threshold, start compiling votes...`);
            compileVote(campaignId, campaign);
        }
        return;
    } catch (err) {
        throw err;
    }
}

//implement lock for possible race condition
const compileVote = async (campaignId, campaign) => {
    const logger = require('./logger');
    const hkey = `${campaignId}pending`;
    const hCompletedkey = `${campaignId}Completed`;
    const skey = `${campaignId}pendingVoted`;
    let votes, tree, merkleRoot, batchCount, processedVote;

    //get campaign;
    // const campaign = sampleCampaign;
    console.log(campaign)

    try {
        const isLocked = await redis.lockTable(hkey);

        //if no lock, call in 2 sec again and end current process
        if (!isLocked) {
            setTimeout(() => compileVote(campaignId), 2000);
            return;
        }
        logger.info(`Lock acquired for ${hkey}, start compiling votes`)
    } catch (err) {
        logger.alert(`Error in aquiring lock, aborting this vote compile...`);
        return;
    }

    //proceed safely with lock
    try {
        //check current count, if not enough end process and release lock
        const pendingCount = await redis.hsetCount(hkey);
        if (pendingCount < Constants.threshold) {
            return;
        }

        const allAddress = await redis.hsetGetKeys(hkey);
        const addressToCompile = allAddress.slice(0, Constants.threshold);

        //prepare redis transaction
        const pipeline = redis.redisClient.multi();
        pipeline.hmget(hkey, ...addressToCompile);
        pipeline.hdel(hkey, ...addressToCompile);
        const results = await pipeline.exec();
        votes = addressToCompile.map((adr, i) => [adr, results[0][1][i]]);
        const tempCount = campaign[1].map(option => 0);
        const hashedVotes = votes.map(v => {
            tempCount[campaign[1].indexOf(v[1])]++;
            return cryptoUtils.hash(JSON.stringify({
                address: v[0],
                option: v[1],
                currentCount: [...tempCount]
            }));
        });
        tree = cryptoUtils.buildMerkleTree(hashedVotes);
        merkleRoot = tree[tree.length - 1][0];
        processedVote = votes.map((v, i) => {
            return {
                address: v[0],
                option: v[1],
                hash: hashedVotes[i],
                merkleProof: cryptoUtils.getMerkleProof(i, tree)
            }
        });
        batchCount = [...tempCount];
    } catch (err) {
        console.log(err)
        logger.error(`Error in compile vote process, aborting this vote compile and releasing lock...`);
        return;
    } finally {
        logger.info(`Lock for ${hkey} has been released.`);
        redis.releaseTable(hkey);
    }

    //submit to smart contract
    try {
        logger.info(`Submitting batch result to ${campaignId}`);
        const receipt = await sendTransaction('uploadBatch', [campaignId, batchCount]);
        const contract = getContract();
        const events = await contract.getPastEvents('UploadBatch', {
            filter: {},
            fromBlock: receipt.blockNumber,
            toBlock: receipt.blockNumber
        });
        const batchId = parseInt(events[0]['returnValues'][2]);

        //sumarize all counted votes with batchId
        const processedVoteForCompleted = processedVote.reduce((a, n) => {
            a[n.address] = JSON.stringify({ ...n, batchId: batchId, merkleRoot: merkleRoot });
            return a;
        }, {});
        console.log(batchId);
        console.log(processedVoteForCompleted);

        await redis.hsetMassSet(hCompletedkey, processedVoteForCompleted);
        logger.info(`Batch result [${batchCount.join(", ")}] has been submited to ${campaignId}`);

    } catch (err) {
        logger.error(`Error in submitting transaction, reinsert votes to pending...`);
        logger.error(err);
        const reAdd = votes.reduce((a, n) => {
            a[n[0]] = n[1];
            return a;
        }, {});
        await redis.hsetMassSet(hkey, reAdd);
    }
}

const getUserVoteByCampaign = async (address, campaignId) => {
    const hkey = `${campaignId}pending`;
    const hCompletedkey = `${campaignId}Completed`;

    const pendingUser = await redis.hsetGet(hkey, address);
    const completedUser = await redis.hsetGet(hCompletedkey, address);

    if (completedUser) return JSON.parse(completedUser);
    return { option: pendingUser };
}

const verifyMerkleProof = async (voteHash, merkleProof, merkleRoot) => {
    return cryptoUtils.verifyMerkleProof(voteHash, merkleProof, merkleRoot);
}

module.exports = { validateContract, startCampaign, endCampaign, castVote, setUploaderWithAddress, getCampaignResults, getUserVoteByCampaign, verifyMerkleProof };