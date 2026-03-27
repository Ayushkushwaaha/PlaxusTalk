// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PlaxusTalk Tip System
/// @notice Send MATIC tips to peers during calls
contract PlaxusTips {

    struct Tip {
        address from;
        address to;
        uint256 amount;   // in wei
        string  roomId;
        string  message;
        uint256 timestamp;
    }

    // All tips ever sent
    Tip[] public tips;

    // wallet → total MATIC received (wei)
    mapping(address => uint256) public totalReceived;

    // wallet → total MATIC sent (wei)
    mapping(address => uint256) public totalSent;

    // wallet → tips they received (indexes)
    mapping(address => uint256[]) public receivedTips;

    // wallet → tips they sent (indexes)
    mapping(address => uint256[]) public sentTips;

    // Platform fee: 1% goes to contract owner
    uint256 public constant FEE_PERCENT = 1;
    address public owner;

    uint256 public totalTipsVolume; // total MATIC tipped (wei)

    event TipSent(
        address indexed from,
        address indexed to,
        uint256 amount,
        string  roomId,
        string  message,
        uint256 timestamp
    );

    constructor() {
        owner = msg.sender;
    }

    /// @notice Send a MATIC tip to a peer
    function sendTip(
        address payable recipient,
        string calldata roomId,
        string calldata message
    ) external payable {
        require(msg.value > 0,            "Tip amount must be > 0");
        require(recipient != address(0),  "Invalid recipient");
        require(recipient != msg.sender,  "Cannot tip yourself");

        // Calculate fee (1%)
        uint256 fee    = (msg.value * FEE_PERCENT) / 100;
        uint256 payout = msg.value - fee;

        // Send tip to recipient
        (bool sent, ) = recipient.call{value: payout}("");
        require(sent, "Transfer failed");

        // Send fee to owner
        if (fee > 0) {
            (bool feeSent, ) = payable(owner).call{value: fee}("");
            require(feeSent, "Fee transfer failed");
        }

        // Record tip
        uint256 tipIndex = tips.length;
        tips.push(Tip({
            from:      msg.sender,
            to:        recipient,
            amount:    msg.value,
            roomId:    roomId,
            message:   message,
            timestamp: block.timestamp
        }));

        receivedTips[recipient].push(tipIndex);
        sentTips[msg.sender].push(tipIndex);

        totalReceived[recipient] += payout;
        totalSent[msg.sender]    += msg.value;
        totalTipsVolume          += msg.value;

        emit TipSent(msg.sender, recipient, msg.value, roomId, message, block.timestamp);
    }

    /// @notice Get all tips received by a wallet
    function getTipsReceived(address wallet) external view returns (Tip[] memory) {
        uint256[] memory indexes = receivedTips[wallet];
        Tip[] memory result = new Tip[](indexes.length);
        for (uint256 i = 0; i < indexes.length; i++) {
            result[i] = tips[indexes[i]];
        }
        return result;
    }

    /// @notice Get all tips sent by a wallet
    function getTipsSent(address wallet) external view returns (Tip[] memory) {
        uint256[] memory indexes = sentTips[wallet];
        Tip[] memory result = new Tip[](indexes.length);
        for (uint256 i = 0; i < indexes.length; i++) {
            result[i] = tips[indexes[i]];
        }
        return result;
    }

    /// @notice Get total number of tips
    function totalTipsCount() external view returns (uint256) {
        return tips.length;
    }
}
