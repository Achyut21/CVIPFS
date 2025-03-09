import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import { createHelia } from 'helia';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { importer } from 'ipfs-unixfs-importer';
import { exporter } from 'ipfs-unixfs-exporter';
import all from 'it-all';

// ------------------------------------------
// Resolve __dirname in ESM
// ------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------
// Create & Configure Express App
// ------------------------------------------
const app = express();
const port = 3001;

app.use(cors());
const upload = multer({ dest: 'uploads/' });

// ------------------------------------------
// Initialize Helia Instance (using top-level await)
// ------------------------------------------
const helia = await createHelia();
console.log('Helia instance created');

// ------------------------------------------
// Read RSA Keys
// ------------------------------------------
const privateKey = fs.readFileSync(path.join(__dirname, '..', 'keys', 'private.pem'), 'utf8');
const publicKey = fs.readFileSync(path.join(__dirname, '..', 'keys', 'public.pem'), 'utf8');

// ------------------------------------------
// Helper Functions: AES encryption/decryption and RSA signing/verification
// ------------------------------------------
function encryptFile(buffer, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { iv: iv.toString('hex'), data: encrypted.toString('hex') };
}

function decryptFile(encryptedBuffer, key, ivHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

function signData(data) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, 'hex');
}

function verifySignature(data, signature) {
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(data);
  verify.end();
  return verify.verify(publicKey, signature, 'hex');
}

// ------------------------------------------
// Helia Helper Functions
// ------------------------------------------

// Add a file to Helia using the UnixFS importer.
async function addFileToHelia(filePath) {
  const source = [{
    path: path.basename(filePath),
    content: fs.createReadStream(filePath)
  }];
  const filesAdded = await all(importer(source, helia.blockstore, {}));
  return filesAdded[0];
}

// Retrieve a file from Helia using a custom resolver that provides a size.
async function getFileFromHelia(cid) {
  const resolver = {
    async get(cid) {
      const block = await helia.blockstore.get(cid);
      if (!block) {
        throw new Error("Block not found for " + cid);
      }
      // Assume block is a Uint8Array and use its byteLength.
      const data = block;
      if (typeof data.byteLength !== 'number') {
        throw new Error("Block data byteLength is undefined for " + cid);
      }
      const size = BigInt(data.byteLength);
      return { cid, bytes: data, size };
    }
  };

  const file = await exporter(cid, resolver);
  if (file.content && typeof file.content[Symbol.asyncIterator] === 'function') {
    const chunks = await all(file.content);
    return Buffer.concat(chunks);
  } else if (file.data) {
    return Buffer.from(file.data);
  } else {
    throw new Error("No iterable content or data available for CID: " + cid);
  }
}

// ------------------------------------------
// Endpoints
// ------------------------------------------

// POST /backup
app.post('/backup', upload.single('file'), async (req, res) => {
  try {
    // 1. Read the uploaded file
    const fileBuffer = fs.readFileSync(req.file.path);

    // 2. Compute file hash for integrity
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 3. Generate AES key (32 bytes)
    const aesKey = crypto.randomBytes(32);

    // 4. Encrypt the file
    const encrypted = encryptFile(fileBuffer, aesKey);

    // 5. Prepare metadata
    const metadata = {
      filename: req.file.originalname,
      timestamp: new Date().toISOString(),
      version: 1,
      iv: encrypted.iv,
      aesKey: aesKey.toString('hex'),
      fileHash
    };

    // 6. Sign the metadata
    const metadataStr = JSON.stringify(metadata);
    const signature = signData(metadataStr);
    metadata.signature = signature;

    // 7. Save the encrypted data temporarily for Helia upload
    const tempFilePath = req.file.path + '_encrypted';
    fs.writeFileSync(tempFilePath, Buffer.from(encrypted.data, 'hex'));

    // 8. Upload the encrypted file to Helia
    const fileAdded = await addFileToHelia(tempFilePath);

    // 9. Cleanup temporary files
    fs.unlinkSync(req.file.path);
    fs.unlinkSync(tempFilePath);

    // 10. Respond with the Helia CID and metadata
    res.json({
      cid: fileAdded.cid.toString(),
      metadata,
      message: 'Backup successful: file encrypted, signed, and stored on Helia.'
    });
  } catch (err) {
    console.error('Backup error details:', err);
    res.status(500).json({ error: 'Error during backup process.', details: err.message });
  }
});

// GET /restore
app.get('/restore', async (req, res) => {
  const { cid, iv, aesKey, expectedHash } = req.query;
  if (!cid || !iv || !aesKey || !expectedHash) {
    return res.status(400).json({ error: 'Missing required query parameters.' });
  }
  try {
    // Retrieve encrypted file from Helia
    const encryptedBuffer = await getFileFromHelia(cid);

    // Decrypt the file using the provided AES key and IV
    const keyBuffer = Buffer.from(aesKey, 'hex');
    const decryptedBuffer = decryptFile(encryptedBuffer, keyBuffer, iv);

    // Verify file integrity
    const decryptedHash = crypto.createHash('sha256').update(decryptedBuffer).digest('hex');
    if (decryptedHash !== expectedHash) {
      return res.status(400).json({ error: 'File integrity check failed.' });
    }

    // Send the decrypted file as an attachment
    res.set('Content-Disposition', `attachment; filename="restored_${Date.now()}"`);
    res.send(decryptedBuffer);
  } catch (err) {
    console.error('Restore error details:', err);
    res.status(500).json({ error: 'Error during restore process.', details: err.message });
  }
});

// GET /verifyMetadata
app.get('/verifyMetadata', (req, res) => {
  const { metadata } = req.query;
  if (!metadata) {
    return res.status(400).json({ error: 'Missing metadata parameter.' });
  }
  try {
    const metadataObj = JSON.parse(metadata);
    const signature = metadataObj.signature;
    delete metadataObj.signature;
    const dataStr = JSON.stringify(metadataObj);
    const valid = verifySignature(dataStr, signature);
    res.json({ valid });
  } catch (err) {
    console.error('Verify metadata error details:', err);
    res.status(500).json({ error: 'Error verifying metadata signature.' });
  }
});

// POST /decryptFile
// Accepts an already-encrypted file plus key, iv, and optional expectedHash.
// Decrypts the file and returns it as a downloadable attachment.
app.post('/decryptFile', upload.single('file'), async (req, res) => {
    try {
      const encryptedFileBuffer = fs.readFileSync(req.file.path);
      const { aesKey, iv, expectedHash } = req.body;
      if (!aesKey || !iv) {
        return res.status(400).json({ error: 'Missing aesKey or iv in request body.' });
      }
  
      // Convert the hex key into a Buffer
      const keyBuffer = Buffer.from(aesKey, 'hex');
  
      // Decrypt the file using the same decryptFile function you used for /restore
      const decryptedBuffer = decryptFile(encryptedFileBuffer, keyBuffer, iv);
  
      // If expectedHash is provided, compare to ensure integrity
      if (expectedHash) {
        const fileHash = crypto.createHash('sha256').update(decryptedBuffer).digest('hex');
        if (fileHash !== expectedHash) {
          // Clean up the temp file
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: 'File integrity check failed.' });
        }
      }
  
      // Clean up the temp file
      fs.unlinkSync(req.file.path);
  
      // Return the decrypted file as an attachment
      res.set('Content-Disposition', `attachment; filename="decrypted_${Date.now()}"`);
      res.send(decryptedBuffer);
    } catch (err) {
      console.error('Decryption error details:', err);
      res.status(500).json({ error: 'Error during file decryption.', details: err.message });
    }
  });
  

// ------------------------------------------
// Start the Server
// ------------------------------------------
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});