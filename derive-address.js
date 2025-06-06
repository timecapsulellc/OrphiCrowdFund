const { createHash } = require('crypto');
const secp256k1 = require('secp256k1');

function privateKeyToAddress(privateKey) {
  // Remove 0x if present
  privateKey = privateKey.replace('0x', '');
  
  // Convert to buffer
  const privateKeyBuffer = Buffer.from(privateKey, 'hex');
  
  // Get public key
  const publicKey = secp256k1.publicKeyCreate(privateKeyBuffer, false);
  
  // Remove first byte (0x04) and hash with keccak256
  const keccak = require('keccak');
  const hash = keccak('keccak256').update(publicKey.slice(1)).digest();
  
  // Take last 20 bytes as address
  const address = '0x' + hash.slice(-20).toString('hex');
  
  // Convert to checksum address
  return toChecksumAddress(address);
}

function toChecksumAddress(address) {
  address = address.toLowerCase().replace('0x', '');
  const hash = createHash('keccak256').update(address).digest('hex');
  let result = '0x';
  
  for (let i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      result += address[i].toUpperCase();
    } else {
      result += address[i];
    }
  }
  
  return result;
}

// Your private key
const privateKey = '6f01e09bbd0158f1ce021b175400a2f53bb556ede4b57c465e327589c9c4c254';

try {
  const address = privateKeyToAddress(privateKey);
  console.log('Wallet Address:', address);
} catch (error) {
  console.error('Error deriving address:', error.message);
}
