// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PlaxusTalk Call Registry
/// @notice Records every call permanently on blockchain
contract PlaxusCallRegistry {

    struct CallRecord {
        string  roomId;
        address user1;
        address user2;
        uint256 startTime;
        uint256 endTime;
        uint256 duration;    // seconds
        uint256 avgLatency;  // milliseconds
        bool    exists;
    }

    // roomId → CallRecord
    mapping(string => CallRecord) public calls;

    // wallet → list of roomIds they participated in
    mapping(address => string[]) public userCalls;

    // all room IDs ever registered
    string[] public allRoomIds;

    uint256 public totalCalls;
    uint256 public totalDuration; // seconds

    // Events
    event CallStarted(
        string  indexed roomId,
        address indexed user1,
        uint256 startTime
    );

    event CallEnded(
        string  indexed roomId,
        address indexed user1,
        address indexed user2,
        uint256 duration,
        uint256 avgLatency
    );

    /// @notice Register start of a call
    function startCall(string calldata roomId) external {
        require(!calls[roomId].exists, "Call already registered");
        require(bytes(roomId).length > 0, "Room ID required");

        calls[roomId] = CallRecord({
            roomId:     roomId,
            user1:      msg.sender,
            user2:      address(0),
            startTime:  block.timestamp,
            endTime:    0,
            duration:   0,
            avgLatency: 0,
            exists:     true
        });

        userCalls[msg.sender].push(roomId);
        allRoomIds.push(roomId);
        totalCalls++;

        emit CallStarted(roomId, msg.sender, block.timestamp);
    }

    /// @notice Register end of a call with stats
    function endCall(
        string calldata roomId,
        uint256 durationSeconds,
        uint256 avgLatencyMs
    ) external {
        require(calls[roomId].exists, "Call not found");
        require(calls[roomId].endTime == 0, "Call already ended");

        CallRecord storage c = calls[roomId];
        c.user2      = msg.sender;
        c.endTime    = block.timestamp;
        c.duration   = durationSeconds;
        c.avgLatency = avgLatencyMs;

        if (c.user2 != c.user1) {
            userCalls[msg.sender].push(roomId);
        }

        totalDuration += durationSeconds;

        emit CallEnded(roomId, c.user1, msg.sender, durationSeconds, avgLatencyMs);
    }

    /// @notice Get full call record
    function getCall(string calldata roomId) external view returns (CallRecord memory) {
        return calls[roomId];
    }

    /// @notice Get all calls for a wallet
    function getUserCalls(address wallet) external view returns (string[] memory) {
        return userCalls[wallet];
    }

    /// @notice Get total number of calls
    function getTotalCalls() external view returns (uint256) {
        return totalCalls;
    }

    /// @notice Get total call minutes
    function getTotalMinutes() external view returns (uint256) {
        return totalDuration / 60;
    }

    /// @notice Get all room IDs (paginated)
    function getRoomIds(uint256 offset, uint256 limit) external view returns (string[] memory) {
        uint256 end = offset + limit;
        if (end > allRoomIds.length) end = allRoomIds.length;
        string[] memory result = new string[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allRoomIds[i];
        }
        return result;
    }
}
