// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PlaxusTalk Identity Verifier
/// @notice Allows users to verify their identity on-chain
contract PlaxusIdentity {

    struct Verification {
        address wallet;
        string  userId;       // MongoDB user ID (off-chain reference)
        string  userName;     // Display name
        uint256 timestamp;
        bool    isVerified;
    }

    // wallet address → verification record
    mapping(address => Verification) public verifications;

    // all verified addresses
    address[] public verifiedAddresses;

    // Events
    event IdentityVerified(
        address indexed wallet,
        string  userId,
        string  userName,
        uint256 timestamp
    );

    event IdentityRevoked(address indexed wallet, uint256 timestamp);

    /// @notice Verify your identity on-chain
    function verifyIdentity(string calldata userId, string calldata userName) external {
        require(bytes(userId).length > 0,   "User ID required");
        require(bytes(userName).length > 0, "Username required");

        if (!verifications[msg.sender].isVerified) {
            verifiedAddresses.push(msg.sender);
        }

        verifications[msg.sender] = Verification({
            wallet:     msg.sender,
            userId:     userId,
            userName:   userName,
            timestamp:  block.timestamp,
            isVerified: true
        });

        emit IdentityVerified(msg.sender, userId, userName, block.timestamp);
    }

    /// @notice Revoke your own verification
    function revokeIdentity() external {
        require(verifications[msg.sender].isVerified, "Not verified");
        verifications[msg.sender].isVerified = false;
        emit IdentityRevoked(msg.sender, block.timestamp);
    }

    /// @notice Check if a wallet is verified
    function isVerified(address wallet) external view returns (bool) {
        return verifications[wallet].isVerified;
    }

    /// @notice Get verification details for a wallet
    function getVerification(address wallet) external view returns (Verification memory) {
        return verifications[wallet];
    }

    /// @notice Get total number of verified users
    function totalVerified() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < verifiedAddresses.length; i++) {
            if (verifications[verifiedAddresses[i]].isVerified) count++;
        }
        return count;
    }
}
