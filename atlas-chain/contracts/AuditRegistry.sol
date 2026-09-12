// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ForeSure AI Decision Audit Registry
/// @notice 極簡存證合約:只允許新增紀錄與查詢,不可修改、不可刪除
contract AuditRegistry {

    struct Record {
        bytes32 contentHash;   // AI 決策文件的 SHA-256
        uint256 timestamp;     // 上鏈時間(區塊時間戳)
        address submitter;     // 寫入者地址(ForeSure 後端服務錢包)
    }

    // decisionId(字串) => 存證紀錄
    mapping(string => Record) private records;

    event DecisionRecorded(
        string indexed decisionId,
        bytes32 contentHash,
        uint256 timestamp,
        address submitter
    );

    /// @notice 寫入一筆新的 AI 決策存證(同一個 decisionId 只能寫入一次,避免竄改覆蓋)
    function recordDecision(string calldata decisionId, bytes32 contentHash) external {
        require(records[decisionId].timestamp == 0, "Decision already recorded");
        records[decisionId] = Record({
            contentHash: contentHash,
            timestamp: block.timestamp,
            submitter: msg.sender
        });
        emit DecisionRecorded(decisionId, contentHash, block.timestamp, msg.sender);
    }

    /// @notice 查詢並驗證:傳入原始 hash,比對鏈上紀錄是否一致
    function verifyDecision(string calldata decisionId, bytes32 hashToCheck)
        external
        view
        returns (bool matched, uint256 timestamp, address submitter)
    {
        Record memory r = records[decisionId];
        matched = (r.contentHash == hashToCheck && r.timestamp != 0);
        return (matched, r.timestamp, r.submitter);
    }

    /// @notice 單純查詢某筆決策的鏈上紀錄
    function getRecord(string calldata decisionId)
        external
        view
        returns (bytes32 contentHash, uint256 timestamp, address submitter)
    {
        Record memory r = records[decisionId];
        return (r.contentHash, r.timestamp, r.submitter);
    }
}
