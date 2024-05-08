const cluster = require('cluster');
const os = require('os');
const express = require('express');
const bodyParser = require('body-parser')
const { flush, hsetGet, sismember, hsetMassGet } = require('./redisClient');
const { startCampaign, endCampaign, castVote, validateContract, setUploaderWithAddress, getUserVoteByCampaign, getCampaignResults, verifyMerkleProof } = require('./voteService');

const numCPUs = os.cpus().length - 4;

if (cluster.isPrimary) {
  require('./logger').info('Master instance started!');
  flush()
    .then(res => require('./logger').info('Redis has been flushed!!!'))
    .catch(err => require('./logger').error('Failed to flush Redis'))
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    require('./logger').info('Labor instance dead...')
  });
} else {
  const app = express();
  const jsonParser = bodyParser.json();

  app.get('/', async (req, res) => {
    const rc = await hsetMassGet('1pending', 'aaa', 'bbb', 'ccc');
    console.log(rc);
    res.send(JSON.stringify(rc));
  });

  app.get('/test', async (req, res) => {
    validateContract();
    res.send("OK");
  });

  app.post('/setUploader', jsonParser, async (req, res) => {
    let result = await setUploaderWithAddress(req.body.address);
    res.send("OK");
  });

  app.post('/getCampaignResults', jsonParser, async (req, res) => {
    const campaign = await getCampaignResults(req.body.id);
    res.send({
      name: campaign[0],
      options: campaign[1],
      results: campaign[2].map(bi => parseInt(bi)),
      isActive: campaign[3]
    });
  });

  app.post('/startCampaign', jsonParser, async (req, res) => {
    startCampaign(req.body.name, req.body.options)
      .then(result => {
        res.status(200).send(`${result}`)
      })
      .catch(err => {
        console.log(err);
        res.status(500).send(err.message);
      })
  });

  app.post('/endCampaign', jsonParser, async (req, res) => {
    endCampaign(req.body.id)
      .then(result => {
        res.status(200).send(`${result}`)
      })
      .catch(err => {
        console.log(err);
        res.status(500).send(err.message);
      })
  });

  app.post('/cast', jsonParser, (req, res) => {
    castVote(req.body.address, req.body.message, req.body.campianId)
      .then(r => res.send('Voted!'))
      .catch(err => res.status(500).send(err.message));
  })

  app.post('/getUserVoteByCampaign', jsonParser, (req, res) => {
    getUserVoteByCampaign(req.body.address, req.body.campianId)
      .then(r => res.send(r))
      .catch(err => res.status(500).send(err.message));
  })

  app.post('/verifyMerkleProof', jsonParser, (req, res) => {
    verifyMerkleProof(req.body.voteHash, req.body.merkleProof, req.body.merkleRoot)
      .then(r => res.send(r))
      .catch(err => res.status(500).send(err.message));
  })

  app.listen(3000, () => {
    require('./logger').info('Labor instance started!')
  });
}

