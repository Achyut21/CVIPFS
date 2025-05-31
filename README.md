# CryptoVault IPFS 🔐🚀

CryptoVault IPFS is a decentralized backup and recovery system that leverages the power of **IPFS (InterPlanetary File System)** to securely store encrypted files. By combining **AES** symmetric encryption with **RSA** digital signatures, CryptoVault IPFS ensures your sensitive files remain confidential and tamper proof.

---

## 📖 Overview

CryptoVault IPFS allows users to encrypt files locally, store them securely on IPFS, and retrieve them using a unique **CID** with metadata (AES key, IV, file hash, and file extension). Users can later decrypt their files by re-uploading them with the correct metadata, ensuring full control over data privacy.

---

## ✨ Features

- **Secure Encryption:** AES-256-CBC for file encryption.
- **Digital Signatures:** RSA signing for metadata integrity verification.
- **Decentralized Storage:** Upload encrypted files to IPFS.
- **Metadata Backup:** Save CID, AES key, IV, file hash, and extension for recovery.
- **Two-Step Recovery Process:**
  1. **Backup:** Encrypt and upload files to get a CID & metadata.
  2. **Recovery:** Download encrypted files from IPFS, re-upload with metadata for decryption.
- **File Type Preservation:** Retains original file format upon decryption.

---

## 🛠 Prerequisites

- **Node.js** v18 or later (for top-level await support)
- **npm** (comes with Node.js)
- **IPFS node or Helia configuration** (for storing files on a decentralized network)
- **RSA keys** for signing and verification

---

## ⚙️ Installation & Setup

### Backend

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/Achyut21/CVIPFS.git
   cd cryptovault-ipfs/backend
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   npm install helia
   npm install express cors multer
   ```
3. **Generate RSA Keys:**
   ```bash
   mkdir keys
   openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048
   openssl rsa -pubout -in keys/private.pem -out keys/public.pem
   ```
4. **Run the Backend Server:**
   ```bash
   npm start
   ```
   Expected Output:
   ```
   Helia instance created
   Backend running on port 3001
   ```

### Frontend

1. **Navigate to the Frontend Folder:**
   ```bash
   cd ../frontend
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Run the Frontend:**
   ```bash
   npm run dev
   ```
   The app should be accessible at [**http://localhost:5173**](http://localhost:5173).

---

## 🔄 How It Works

### Backup Flow 🚀

1. **Upload File:** Select a file in the frontend and send it to the backend.
2. **Encryption & Storage:**
   - Encrypts the file using AES-256-CBC.
   - Generates a random AES key and IV.
   - Computes a SHA-256 hash for integrity.
   - Uploads the encrypted file to IPFS (via Helia).
   - Returns a CID with metadata (AES key, IV, file hash, file extension, and RSA signature).
3. **Save Your Metadata:** Securely store the metadata for future recovery.

### Recovery Flow 🔓

1. **Download Encrypted File:** Retrieve the file using the CID from IPFS.
2. **Decrypt File:** Upload the encrypted file with saved metadata to recover the original file.

### Metadata Verification

- Verify the RSA signature on metadata to ensure it hasn't been tampered with.

---

## 📚 Usage Notes

- **Security:** AES key and IV should be securely stored (e.g., encrypting them with RSA or a secure vault).
- **Persistence:** Default Helia setup uses an in-memory blockstore; configure persistent storage for real-world applications.
- **File Type:** The file extension is retained to restore the original format upon decryption.

---

## 🤝 Contributing

Feel free to fork the repository, enhance the code, and submit pull requests. For issues or feature requests, please open an issue on GitHub.

---

## 📄 License

This project is for educational and demonstrative purposes. Refer to the LICENSE file for details.

---

## 🚀 Final Thoughts

CryptoVault IPFS empowers you to take control of your data privacy with decentralized and secure storage. No reliance on centralized cloud providers—just full ownership and security of your files!

Happy Coding! 🎉

