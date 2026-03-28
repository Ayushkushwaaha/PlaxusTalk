import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useContracts } from '../hooks/useContracts';

// Load contract addresses if deployed
import { CONTRACT_ADDRESSES } from '../lib/contracts.js';

function PolygonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 38 33" fill="none">
      <path d="M28.8 10.2a2.6 2.6 0 00-2.6 0L20.6 13.4l-3.8 2.1-5.4 3.2a2.6 2.6 0 01-2.6 0L5 15.9a2.6 2.6 0 01-1.3-2.3V9.8a2.6 2.6 0 011.3-2.3L8.8 5.4a2.6 2.6 0 012.6 0l3.8 2.1a2.6 2.6 0 011.3 2.3v3.2l3.8-2.2V7.5a2.6 2.6 0 00-1.3-2.3L12.7 1A2.6 2.6 0 0010.1 1L3.3 5a2.6 2.6 0 00-1.3 2.3v8.2A2.6 2.6 0 003.3 18l6.8 3.9a2.6 2.6 0 002.6 0l5.4-3.2 3.8-2.2 5.4-3.2a2.6 2.6 0 012.6 0l3.8 2.1a2.6 2.6 0 011.3 2.3v3.8a2.6 2.6 0 01-1.3 2.3L30.6 27a2.6 2.6 0 01-2.6 0l-3.8-2.1a2.6 2.6 0 01-1.3-2.3v-3.2l-3.8 2.2v3.2a2.6 2.6 0 001.3 2.3l6.8 3.9a2.6 2.6 0 002.6 0l6.8-3.9a2.6 2.6 0 001.3-2.3v-7.8a2.6 2.6 0 00-1.3-2.3l-8.8-5z" fill="#8247E5"/>
    </svg>
  );
}

export default function WalletButton({ onWalletConnected, currentUser, roomId }) {
  const {
    address, shortAddress, isInstalled, isConnecting, error, connect,
  } = useWallet();

  const { verifyIdentityOnChain, checkVerification, loading, txHash } = useContracts(CONTRACT_ADDRESSES);

  const [verificationStatus, setVerificationStatus] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  // Check on-chain verification status when wallet connects
  useEffect(() => {
    if (!address) return;
    checkVerification(address).then(setVerificationStatus);
  }, [address]);

  const handleConnect = async () => {
    const addr = await connect();
    if (addr && onWalletConnected) onWalletConnected(addr);
  };

  const handleVerify = async () => {
    if (!address || !currentUser) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const result = await verifyIdentityOnChain(currentUser.id, currentUser.name);
      setVerifyResult(result);
      setVerificationStatus({ isVerified: true, userName: currentUser.name, timestamp: Date.now() / 1000 });
    } catch (err) {
      setVerifyError(err.message?.includes('user rejected') ? 'Transaction cancelled' : err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {!address ? (
        <button onClick={handleConnect} disabled={isConnecting || !isInstalled}
          className="flex items-center gap-2 border border-border hover:border-accent/40
                     bg-panel text-white font-display text-xs tracking-widest uppercase
                     px-4 py-2.5 transition-all hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed">
          {isConnecting ? (
            <><span className="w-3 h-3 border border-accent/50 border-t-accent rounded-full animate-spin" />CONNECTING...</>
          ) : !isInstalled ? (
            <><span className="text-warn">⚠</span> NO METAMASK</>
          ) : (
            <><PolygonIcon />CONNECT WALLET</>
          )}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Address */}
          <div className="flex items-center gap-2 border border-accent/20 bg-accent/5 px-4 py-2.5">
            <PolygonIcon />
            <span className="font-display text-xs text-accent tracking-widest">{shortAddress}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse ml-auto" />
          </div>

          {/* Verification status */}
          {verificationStatus?.isVerified ? (
            <div className="border border-accent/20 bg-panel px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-accent text-xs">✓</span>
                <span className="font-display text-xs text-accent tracking-widest">VERIFIED ON-CHAIN</span>
              </div>
              {verifyResult && (
                <a href={verifyResult.url} target="_blank" rel="noopener noreferrer"
                  className="font-display text-xs text-info hover:text-info/70 transition-colors block">
                  VIEW TX ON POLYGONSCAN →
                </a>
              )}
              {!verifyResult && (
                <p className="font-display text-xs text-muted/60">
                  Since: {new Date(verificationStatus.timestamp * 1000).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <button onClick={handleVerify} disabled={verifying || loading}
              className="flex items-center justify-center gap-2 border border-info/30 hover:border-info/60
                         bg-info/5 text-info font-display text-xs tracking-widest uppercase
                         px-4 py-2 transition-all disabled:opacity-60">
              {verifying || loading ? (
                <><span className="w-3 h-3 border border-info/50 border-t-info rounded-full animate-spin" />VERIFYING ON-CHAIN...</>
              ) : (
                <>◈ VERIFY IDENTITY</>
              )}
            </button>
          )}

          {verifyError && <p className="font-display text-xs text-warn">{verifyError}</p>}

          {txHash && !verifyResult && (
            <a href={`https://mumbai.polygonscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="font-display text-xs text-info hover:text-info/70 transition-colors">
              TX PENDING → VIEW ON POLYGONSCAN
            </a>
          )}

          {!CONTRACT_ADDRESSES && (
            <p className="font-display text-xs text-muted/40 tracking-widest">
              Deploy contracts to enable on-chain verification
            </p>
          )}
        </div>
      )}
      {error && <p className="font-display text-xs text-warn">{error}</p>}
    </div>
  );
}
