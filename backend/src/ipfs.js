const axios = require('axios');

// Support both JWT and API Key authentication
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

const PINATA_API = 'https://api.pinata.cloud';
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

function isPinataConfigured() {
  return !!(PINATA_JWT || (PINATA_API_KEY && PINATA_API_SECRET));
}

function getAuthHeaders() {
  if (PINATA_JWT) {
    return { Authorization: `Bearer ${PINATA_JWT}` };
  }
  return {
    pinata_api_key: PINATA_API_KEY,
    pinata_secret_api_key: PINATA_API_SECRET,
  };
}

async function pinJSON(data, name = 'plaxustalk-data') {
  if (!isPinataConfigured()) throw new Error('Pinata not configured');
  const res = await axios.post(
    `${PINATA_API}/pinning/pinJSONToIPFS`,
    {
      pinataContent: data,
      pinataMetadata: { name },
      pinataOptions: { cidVersion: 1 },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    }
  );
  return res.data.IpfsHash;
}

async function fetchFromIPFS(cid) {
  const res = await axios.get(`${IPFS_GATEWAY}/${cid}`, { timeout: 10000 });
  return res.data;
}

function getIPFSUrl(cid) {
  return `${IPFS_GATEWAY}/${cid}`;
}

module.exports = { pinJSON, fetchFromIPFS, getIPFSUrl, isPinataConfigured };