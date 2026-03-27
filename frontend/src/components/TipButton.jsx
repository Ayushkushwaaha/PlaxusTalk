import React, { useState } from 'react';

const TIP_AMOUNTS = [0.01, 0.05, 0.1, 0.5, 1];

export default function TipButton({ recipientAddress, roomId, onSendTip, loading }) {
  const [showPanel, setShowPanel] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [sent, setSent] = useState(null);

  if (!recipientAddress) return null;

  const handleSend = async (amount) => {
    try {
      const result = await onSendTip(recipientAddress, roomId, message, amount);
      setSent(result);
      setShowPanel(false);
      setMessage('');
      setSelectedAmount(null);
    } catch (err) {
      console.error('Tip failed:', err);
    }
  };

  return (
    <div className="relative">
      {/* Sent confirmation */}
      {sent && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-panel border border-accent/40 px-4 py-3 whitespace-nowrap z-50">
          <p className="font-display text-xs text-accent tracking-widest">✓ TIP SENT!</p>
          <a href={sent.url} target="_blank" rel="noopener noreferrer"
            className="font-display text-xs text-info hover:text-info/70 transition-colors">
            VIEW ON POLYGONSCAN →
          </a>
        </div>
      )}

      {/* Tip panel */}
      {showPanel && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-panel border border-border p-5 z-50 w-72">
          <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent mb-4" />
          <p className="font-display text-xs text-accent tracking-widest mb-3">SEND MATIC TIP</p>

          {/* Quick amounts */}
          <div className="grid grid-cols-5 gap-1 mb-3">
            {TIP_AMOUNTS.map((a) => (
              <button key={a} onClick={() => setSelectedAmount(a)}
                className={`py-2 font-display text-xs tracking-wider transition-all border ${
                  selectedAmount === a
                    ? 'border-accent bg-accent text-void'
                    : 'border-border text-muted hover:border-accent/40 hover:text-white'
                }`}>
                {a}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="flex gap-2 mb-3">
            <input
              type="number"
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
              placeholder="Custom MATIC"
              min="0.001"
              step="0.001"
              className="flex-1 bg-void border border-border text-white font-body text-sm px-3 py-2 outline-none focus:border-accent/50 transition-all"
            />
          </div>

          {/* Message */}
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            className="w-full bg-void border border-border text-white font-body text-sm px-3 py-2 outline-none focus:border-accent/50 transition-all mb-3"
          />

          <div className="flex gap-2">
            <button
              onClick={() => handleSend(selectedAmount || parseFloat(customAmount))}
              disabled={loading || (!selectedAmount && !customAmount)}
              className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="w-3 h-3 border-2 border-void border-t-transparent rounded-full animate-spin" />SENDING...</>
              ) : (
                `💸 SEND ${selectedAmount || customAmount || '?'} MATIC`
              )}
            </button>
            <button onClick={() => setShowPanel(false)}
              className="border border-border text-muted font-display text-xs px-3 py-2 hover:text-white transition-colors">
              ✕
            </button>
          </div>

          <p className="font-display text-xs text-muted/40 text-center mt-3 tracking-widest">
            1% PLATFORM FEE · POLYGON MUMBAI
          </p>
        </div>
      )}

      <button
        onClick={() => { setShowPanel((s) => !s); setSent(null); }}
        className={`w-12 h-12 flex items-center justify-center border transition-all rounded-sm text-lg
          ${showPanel ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border bg-panel text-white hover:border-accent/40'}`}
        title="Send MATIC tip"
      >
        💸
      </button>
    </div>
  );
}
