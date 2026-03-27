import { useState, useCallback } from 'react';

// Contract ABIs (minimal - only functions we use)
const IDENTITY_ABI = [
  "function verifyIdentity(string userId, string userName) external",
  "function revokeIdentity() external",
  "function isVerified(address wallet) external view returns (bool)",
  "function getVerification(address wallet) external view returns (tuple(address wallet, string userId, string userName, uint256 timestamp, bool isVerified))",
  "function totalVerified() external view returns (uint256)",
  "event IdentityVerified(address indexed wallet, string userId, string userName, uint256 timestamp)",
];

const REGISTRY_ABI = [
  "function startCall(string roomId) external",
  "function endCall(string roomId, uint256 durationSeconds, uint256 avgLatencyMs) external",
  "function getCall(string roomId) external view returns (tuple(string roomId, address user1, address user2, uint256 startTime, uint256 endTime, uint256 duration, uint256 avgLatency, bool exists))",
  "function getUserCalls(address wallet) external view returns (string[])",
  "function getTotalCalls() external view returns (uint256)",
  "function getTotalMinutes() external view returns (uint256)",
  "event CallStarted(string indexed roomId, address indexed user1, uint256 startTime)",
  "event CallEnded(string indexed roomId, address indexed user1, address indexed user2, uint256 duration, uint256 avgLatency)",
];

const TIPS_ABI = [
  "function sendTip(address recipient, string roomId, string message) external payable",
  "function getTipsReceived(address wallet) external view returns (tuple(address from, address to, uint256 amount, string roomId, string message, uint256 timestamp)[])",
  "function getTipsSent(address wallet) external view returns (tuple(address from, address to, uint256 amount, string roomId, string message, uint256 timestamp)[])",
  "function totalTipsCount() external view returns (uint256)",
  "function totalReceived(address) external view returns (uint256)",
  "event TipSent(address indexed from, address indexed to, uint256 amount, string roomId, string message, uint256 timestamp)",
];

const POLYGONSCAN = "https://mumbai.polygonscan.com";

export function useContracts(contractAddresses) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  // Get ethers provider from MetaMask
  const getProvider = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask not installed");
    // Dynamically import ethers
    const { BrowserProvider } = await import("https://esm.sh/ethers@6.9.0");
    return new BrowserProvider(window.ethereum);
  }, []);

  // ── Identity Contract ──────────────────────────────────────────────────────

  const verifyIdentityOnChain = useCallback(async (userId, userName) => {
    if (!contractAddresses?.PlaxusIdentity) throw new Error("Identity contract not deployed yet");
    setLoading(true); setError(null); setTxHash(null);
    try {
      const { Contract } = await import("https://esm.sh/ethers@6.9.0");
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const contract = new Contract(contractAddresses.PlaxusIdentity, IDENTITY_ABI, signer);
      const tx = await contract.verifyIdentity(userId, userName);
      setTxHash(tx.hash);
      await tx.wait();
      return { txHash: tx.hash, url: `${POLYGONSCAN}/tx/${tx.hash}` };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally { setLoading(false); }
  }, [contractAddresses, getProvider]);

  const checkVerification = useCallback(async (walletAddress) => {
    if (!contractAddresses?.PlaxusIdentity) return null;
    try {
      const { Contract, JsonRpcProvider } = await import("https://esm.sh/ethers@6.9.0");
      const provider = new JsonRpcProvider("https://rpc-mumbai.maticvigil.com");
      const contract = new Contract(contractAddresses.PlaxusIdentity, IDENTITY_ABI, provider);
      const result = await contract.getVerification(walletAddress);
      return {
        isVerified: result.isVerified,
        userName: result.userName,
        timestamp: Number(result.timestamp),
      };
    } catch { return null; }
  }, [contractAddresses]);

  // ── Call Registry Contract ─────────────────────────────────────────────────

  const registerCallStart = useCallback(async (roomId) => {
    if (!contractAddresses?.PlaxusCallRegistry) return null;
    setLoading(true); setError(null);
    try {
      const { Contract } = await import("https://esm.sh/ethers@6.9.0");
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const contract = new Contract(contractAddresses.PlaxusCallRegistry, REGISTRY_ABI, signer);
      const tx = await contract.startCall(roomId);
      setTxHash(tx.hash);
      await tx.wait();
      return { txHash: tx.hash, url: `${POLYGONSCAN}/tx/${tx.hash}` };
    } catch (err) {
      setError(err.message);
      return null;
    } finally { setLoading(false); }
  }, [contractAddresses, getProvider]);

  const registerCallEnd = useCallback(async (roomId, durationSeconds, avgLatencyMs) => {
    if (!contractAddresses?.PlaxusCallRegistry) return null;
    setLoading(true); setError(null);
    try {
      const { Contract } = await import("https://esm.sh/ethers@6.9.0");
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const contract = new Contract(contractAddresses.PlaxusCallRegistry, REGISTRY_ABI, signer);
      const tx = await contract.endCall(roomId, durationSeconds, avgLatencyMs);
      await tx.wait();
      return { txHash: tx.hash, url: `${POLYGONSCAN}/tx/${tx.hash}` };
    } catch (err) {
      setError(err.message);
      return null;
    } finally { setLoading(false); }
  }, [contractAddresses, getProvider]);

  const getUserCallHistory = useCallback(async (walletAddress) => {
    if (!contractAddresses?.PlaxusCallRegistry) return [];
    try {
      const { Contract, JsonRpcProvider } = await import("https://esm.sh/ethers@6.9.0");
      const provider = new JsonRpcProvider("https://rpc-mumbai.maticvigil.com");
      const contract = new Contract(contractAddresses.PlaxusCallRegistry, REGISTRY_ABI, provider);
      const roomIds = await contract.getUserCalls(walletAddress);
      return roomIds;
    } catch { return []; }
  }, [contractAddresses]);

  // ── Tips Contract ──────────────────────────────────────────────────────────

  const sendTip = useCallback(async (recipientAddress, roomId, message, amountMatic) => {
    if (!contractAddresses?.PlaxusTips) throw new Error("Tips contract not deployed yet");
    setLoading(true); setError(null); setTxHash(null);
    try {
      const { Contract, parseEther } = await import("https://esm.sh/ethers@6.9.0");
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const contract = new Contract(contractAddresses.PlaxusTips, TIPS_ABI, signer);
      const tx = await contract.sendTip(recipientAddress, roomId, message || "", {
        value: parseEther(amountMatic.toString()),
      });
      setTxHash(tx.hash);
      await tx.wait();
      return { txHash: tx.hash, url: `${POLYGONSCAN}/tx/${tx.hash}` };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally { setLoading(false); }
  }, [contractAddresses, getProvider]);

  const getTipsReceived = useCallback(async (walletAddress) => {
    if (!contractAddresses?.PlaxusTips) return [];
    try {
      const { Contract, JsonRpcProvider, formatEther } = await import("https://esm.sh/ethers@6.9.0");
      const provider = new JsonRpcProvider("https://rpc-mumbai.maticvigil.com");
      const contract = new Contract(contractAddresses.PlaxusTips, TIPS_ABI, provider);
      const tips = await contract.getTipsReceived(walletAddress);
      return tips.map((t) => ({
        from: t.from,
        to: t.to,
        amount: formatEther(t.amount),
        roomId: t.roomId,
        message: t.message,
        timestamp: Number(t.timestamp),
      }));
    } catch { return []; }
  }, [contractAddresses]);

  return {
    loading,
    error,
    txHash,
    polygonscanBase: POLYGONSCAN,
    // Identity
    verifyIdentityOnChain,
    checkVerification,
    // Registry
    registerCallStart,
    registerCallEnd,
    getUserCallHistory,
    // Tips
    sendTip,
    getTipsReceived,
  };
}
