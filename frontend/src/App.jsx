import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';

function App() {
  // ----- States for backup flow -----
  const [file, setFile] = useState(null);
  const [backupResult, setBackupResult] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  
  // ----- States for the "Retrieve file" flow -----
  const [encryptedFile, setEncryptedFile] = useState(null);
  const [encryptedKey, setEncryptedKey] = useState('');
  const [encryptedIv, setEncryptedIv] = useState('');
  const [encryptedHash, setEncryptedHash] = useState('');
  const [fileExtension, setFileExtension] = useState('');
  const [decryptedFileUrl, setDecryptedFileUrl] = useState(null);

  // ----- Handle file selection for backup -----
  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // ----- Handle encrypted file selection -----
  const handleEncryptedFileChange = (e) => {
    if (e.target.files[0]) {
      setEncryptedFile(e.target.files[0]);
    }
  };

  // ----- Custom file input component -----
  const CustomFileInput = ({ onChange, id, label, accept, selectedFile }) => {
    return (
      <div className="mb-4">
        <label htmlFor={id} className="block text-gray-700 font-medium mb-2">
          {label}
        </label>
        <div className="relative">
          <input 
            type="file" 
            id={id} 
            className="hidden" 
            onChange={onChange} 
            accept={accept}
          />
          <label 
            htmlFor={id} 
            className="flex items-center justify-between px-4 py-3 bg-white border-2 border-indigo-300 hover:border-indigo-500 rounded-lg cursor-pointer transition duration-200 overflow-hidden"
          >
            <div className="flex items-center">
              <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </span>
              <span className="text-gray-700 truncate max-w-xs">
                {selectedFile ? selectedFile.name : 'Choose a file...'}
              </span>
            </div>
            <span className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Browse
            </span>
          </label>
        </div>
        {selectedFile && (
          <div className="mt-2 text-sm text-gray-600">
            {selectedFile.size < 1024 * 1024 
              ? `${(selectedFile.size / 1024).toFixed(2)} KB` 
              : `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`}
          </div>
        )}
      </div>
    );
  };

  // ----- Upload file to the backend for backup -----
  const handleBackup = async () => {
    if (!file) {
      alert('Please select a file to backup');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3001/backup', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Backup request failed');
      }
      
      const data = await response.json();
      console.log('Backup result:', data);
      setBackupResult(data);
    } catch (error) {
      console.error('Backup error:', error);
      alert(`Backup failed: ${error.message}`);
    }
  };

  // ----- Export backup details to different formats -----
  const exportBackupDetails = (format) => {
    if (!backupResult) return;
    
    const { cid, metadata } = backupResult;
    const fileName = `backup-details-${new Date().toISOString().slice(0, 10)}`;
    
    if (format === 'pdf') {
      // Create PDF
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Backup Details', 20, 20);
      doc.setFontSize(12);
      doc.text(`CID: ${cid}`, 20, 40);
      doc.text(`Filename: ${metadata.filename}`, 20, 50);
      doc.text(`Timestamp: ${metadata.timestamp}`, 20, 60);
      doc.text(`File Hash: ${metadata.fileHash}`, 20, 70);
      doc.text('To restore this file, you will need the following:', 20, 90);
      doc.text(`IV: ${metadata.iv}`, 20, 100);
      doc.text(`AES Key: ${metadata.aesKey}`, 20, 110);
      doc.save(`${fileName}.pdf`);
    } else if (format === 'json') {
      // Create JSON file
      const blob = new Blob([JSON.stringify(backupResult, null, 2)], { type: 'application/json' });
      saveAs(blob, `${fileName}.json`);
    } else if (format === 'txt') {
      // Create TXT file
      let content = `Backup Details\n\n`;
      content += `CID: ${cid}\n`;
      content += `Filename: ${metadata.filename}\n`;
      content += `Timestamp: ${metadata.timestamp}\n`;
      content += `File Hash: ${metadata.fileHash}\n\n`;
      content += `To restore this file, you will need:\n`;
      content += `IV: ${metadata.iv}\n`;
      content += `AES Key: ${metadata.aesKey}\n`;
      
      const blob = new Blob([content], { type: 'text/plain' });
      saveAs(blob, `${fileName}.txt`);
    }
  };

  // ----- Verify metadata signature -----
  const handleVerifyMetadata = async () => {
    if (!backupResult || !backupResult.metadata) return;
    
    const metadataStr = JSON.stringify(backupResult.metadata);
    const params = new URLSearchParams({ metadata: metadataStr });
    
    try {
      const response = await fetch(`http://localhost:3001/verifyMetadata?${params.toString()}`);
      const data = await response.json();
      setVerifyResult(data.valid ? 'Valid Signature ✓' : 'Invalid Signature ✗');
    } catch (error) {
      console.error('Verification error:', error);
      setVerifyResult('Verification failed');
    }
  };

  // ----- Retrieve file (previously decryptFile) -----
  const handleRetrieveFile = async () => {
    if (!encryptedFile || !encryptedKey || !encryptedIv) {
      alert('Please provide the AES Key, IV, and select a file to retrieve.');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', encryptedFile);
    formData.append('aesKey', encryptedKey);
    formData.append('iv', encryptedIv);
    
    if (encryptedHash) {
      formData.append('expectedHash', encryptedHash);
    }

    try {
      const response = await fetch('http://localhost:3001/decryptFile', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Retrieval error: ${errorBody.error || response.statusText}`);
      }

      // Get the decrypted file as binary
      const blob = await response.blob();
      
      // Create a download link with the proper extension if provided
      let finalBlob = blob;
      let extension = '';
      
      if (fileExtension) {
        extension = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`;
        
        // Create new blob with the same content but different type if possible
        if (extension === '.pdf') {
          finalBlob = new Blob([blob], { type: 'application/pdf' });
        } else if (extension === '.png' || extension === '.jpg' || extension === '.jpeg') {
          finalBlob = new Blob([blob], { type: `image/${extension.substring(1)}` });
        } else if (extension === '.txt') {
          finalBlob = new Blob([blob], { type: 'text/plain' });
        } else if (extension === '.docx') {
          finalBlob = new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        }
      }
      
      const url = URL.createObjectURL(finalBlob);
      setDecryptedFileUrl(url);
    } catch (error) {
      console.error('Retrieval error:', error);
      alert('File retrieval failed. Check console for details.');
    }
  };

  return (
    <div className="max-w-screen mx-auto p-8 min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
          <h1 className="text-3xl font-bold">CryptoVault IPFS</h1>
          <p className="mt-2 opacity-80">Encrypt, store, and retrieve your files securely</p>
        </div>

        {/* ----- Upload Section ----- */}
        <div className="p-8">
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
              <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              </span>
              Upload a file
            </h2>
            
            <div className="mb-6">
              <CustomFileInput
                id="backupFile"
                label="Select a file to upload"
                onChange={handleFileChange}
                selectedFile={file}
              />
              
              <button 
                onClick={handleBackup} 
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition duration-200 ${
                  file 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 cursor-pointer'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                disabled={!file}
              >
                <div className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload file
                </div>
              </button>
            </div>
          </div>

          {backupResult && (
            <div className="mb-10 bg-indigo-50 rounded-xl p-6 border border-indigo-100 shadow-sm">
              <div className="flex items-center mb-4">
                <div className="bg-green-100 p-2 rounded-full mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Upload File</h2>
              </div>
              
              <div className="bg-white rounded-lg p-5 mb-5 shadow-sm">
                <h3 className="font-bold text-lg mb-3 text-gray-800">Upload Details</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-medium text-gray-700 sm:w-24">CID:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm mt-1 sm:mt-0 break-all">{backupResult.cid}</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-medium text-gray-700 sm:w-24">Filename:</span>
                    <span className="mt-1 sm:mt-0">{backupResult.metadata.filename}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-medium text-gray-700 sm:w-24">Timestamp:</span>
                    <span className="mt-1 sm:mt-0">{backupResult.metadata.timestamp}</span>
                  </div>
                </div>
                <div className="text-green-600 font-medium p-2 bg-green-50 rounded-lg flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {backupResult.message}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3 mb-5">
                <button 
                  onClick={handleVerifyMetadata} 
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Verify Signature
                </button>
                {verifyResult && (
                  <span className={`py-2 px-4 rounded-lg font-medium flex items-center ${
                    verifyResult.includes('Valid') 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {verifyResult.includes('Valid') ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {verifyResult}
                  </span>
                )}
              </div>
              
              <div className="bg-white rounded-lg p-5 shadow-sm">
                <h3 className="font-bold text-lg mb-3 text-gray-800">Save Backup Information</h3>
                <p className="text-gray-600 mb-4">
                  Save these details to restore your file later. You'll need this information for retrieval.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button 
                    onClick={() => exportBackupDetails('pdf')} 
                    className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Export as PDF
                  </button>
                  <button 
                    onClick={() => exportBackupDetails('json')} 
                    className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Export as JSON
                  </button>
                  <button 
                    onClick={() => exportBackupDetails('txt')} 
                    className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export as TXT
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ----- Retrieve File Section ----- */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
              <span className="bg-purple-100 text-purple-600 p-2 rounded-lg mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              </span>
              Retrieve File
            </h2>

            <div className="bg-purple-50 rounded-xl p-6 border border-purple-100 shadow-sm">
              <div className="mb-6">
                <CustomFileInput
                  id="retrieveFile"
                  label="Select Encrypted File"
                  onChange={handleEncryptedFileChange}
                  selectedFile={encryptedFile}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Desired File Extension</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={fileExtension}
                      onChange={(e) => setFileExtension(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-white border-2 border-purple-300 hover:border-purple-500 focus:border-purple-500 focus:ring-purple-500 focus:ring-1 focus:outline-none rounded-lg transition duration-200"
                      placeholder="e.g. pdf, jpg, txt, docx"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-1">
                    Specify the extension for the retrieved file (optional)
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">AES Key (hex)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={encryptedKey}
                      onChange={(e) => setEncryptedKey(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-white border-2 border-purple-300 hover:border-purple-500 focus:border-purple-500 focus:ring-purple-500 focus:ring-1 focus:outline-none rounded-lg transition duration-200"
                      placeholder="32-byte key in hex format"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">IV (hex)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={encryptedIv}
                      onChange={(e) => setEncryptedIv(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-white border-2 border-purple-300 hover:border-purple-500 focus:border-purple-500 focus:ring-purple-500 focus:ring-1 focus:outline-none rounded-lg transition duration-200"
                      placeholder="16-byte IV in hex format"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">Expected Hash (optional)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={encryptedHash}
                    onChange={(e) => setEncryptedHash(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 bg-white border-2 border-purple-300 hover:border-purple-500 focus:border-purple-500 focus:ring-purple-500 focus:ring-1 focus:outline-none rounded-lg transition duration-200"
                    placeholder="SHA-256 hash of the original file (for integrity verification)"
                  />
                </div>
              </div>
        <button
          onClick={handleRetrieveFile}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition duration-200"
          disabled={!encryptedFile || !encryptedKey || !encryptedIv}
        >
          Retrieve File
        </button>

        {decryptedFileUrl && (
          <div className="mt-4 p-4 bg-green-100 rounded-lg">
            <p className="text-green-700 font-medium mb-2">File successfully retrieved!</p>
            <a 
              href={decryptedFileUrl} 
              download={`retrieved_file${fileExtension ? (fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`) : ''}`} 
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded inline-block transition duration-200"
            >
              Download Retrieved File
            </a>
          </div>
        )}
      </div>
    </div>
    </div>
    </div>
    </div>
  );
}

export default App;