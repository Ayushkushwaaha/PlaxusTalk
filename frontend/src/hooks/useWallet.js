import { useState, useCallback, useEffect } from 'react';

const SEPOLIA = {
  chainId: '0xaa36a7',
  chainName: 'Sepolia Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.sepolia.org'],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};

export function useWallet() {
  const [address,         setAddress]         = useState(null);
  const [chainId,         setChainId]         = useState(null);
  const [isConnecting,    setIsConnecting]    = useState(false);
  const [error,           setError]           = useState(null);
  const [verificationTx,  setVerificationTx]  = useState(null);
  const [isVerifying,     setIsVerifying]     = useState(false);

  const isInstalled = typeof window !== 'undefined' && !!window.ethereum;

  useEffect(() => {
    if (!isInstalled) return;
    window.ethereum.request({ method: 'eth_accounts' })
      .then((accounts) => { if (accounts[0]) setAddress(accounts[0]); })
      .catch(() => {});

    const handleAccountsChanged = (accounts) => setAddress(accounts[0] || null);
    const handleChainChanged    = (id) => setChainId(id);

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged',    handleChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged',    handleChainChanged);
    };
  }, [isInstalled]);

  const connect = useCallback(async () => {
    if (!isInstalled) { setError('MetaMask not installed'); return null; }
    setIsConnecting(true);
    setError(null);
    try {
      const accounts    = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
      setAddress(accounts[0]);
      setChainId(currentChain);

      if (currentChain !== SEPOLIA.chainId) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA.chainId }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [SEPOLIA],
            });
          }
        }
      }
      return accounts[0];
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [isInstalled]);

  const verifyIdentity = useCallback(async () => {
    if (!address) return;
    setIsVerifying(true);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const mockTx = '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)).join('');
      setVerificationTx(mockTx);
    } finally {
      setIsVerifying(false);
    }
  }, [address]);

  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  return {
    address, shortAddress, chainId, isInstalled,
    isConnecting, error, verificationTx, isVerifying,
    connect, verifyIdentity,
  };
}