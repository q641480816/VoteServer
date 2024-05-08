const Redis = require('ioredis');
const { promisify } = require('util');

const redisClient = new Redis({
    host: '172.29.53.104',
    port: 6379,
});

const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const deleteAsWhole = promisify(redisClient.del).bind(redisClient);
const setAdd = promisify(redisClient.sadd).bind(redisClient);
const setRemove = promisify(redisClient.srem).bind(redisClient);
const sismember = promisify(redisClient.sismember).bind(redisClient);
const hsetAdd = promisify(redisClient.hset).bind(redisClient);
const hsetDelete = promisify(redisClient.hdel).bind(redisClient);
const hsetGet = promisify(redisClient.hget).bind(redisClient);
const hsetGetKeys = promisify(redisClient.hkeys).bind(redisClient);
const hsetCount = promisify(redisClient.hlen).bind(redisClient);
const hsetMassGet = promisify(redisClient.hmget).bind(redisClient);
const hsetMassSet = promisify(redisClient.hmset).bind(redisClient);
const flush = promisify(redisClient.flushdb).bind(redisClient);

const lockTable = async (table, timeout = 10000) => {
    try {
        const lockValue = Date.now() + timeout + 1;
        const locked = await redisClient.set(`${table}LOCK`, lockValue, 'NX', 'PX', timeout);
        console.log(locked);
        if (locked) {
            return lockValue;
        }
        return false;
    } catch (err) {
        throw err;
    }
}

const releaseTable = async (table) => {
    try {
        await redisClient.del(`${table}LOCK`);
        return true;
    } catch (err) {
        throw err;
    }
}


module.exports = { flush, redisClient, getAsync, setAsync, setAdd, sismember, hsetAdd, hsetGetKeys, hsetDelete, setRemove, deleteAsWhole, hsetGet, hsetCount, hsetMassGet, lockTable, releaseTable, hsetMassSet };