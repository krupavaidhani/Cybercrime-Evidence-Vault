// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract EvidenceVault is AccessControl {
    // Role Definitions
    bytes32 public constant IO_ROLE = keccak256("IO_ROLE");
    bytes32 public constant SO_ROLE = keccak256("SO_ROLE");
    bytes32 public constant CUSTODIAN_ROLE = keccak256("CUSTODIAN_ROLE");
    bytes32 public constant EXAMINER_ROLE = keccak256("EXAMINER_ROLE");
    bytes32 public constant HOD_ROLE = keccak256("HOD_ROLE");

    enum EvidenceStatus {
        CREATED,
        COLLECTED,
        IN_TRANSIT,
        SECURED,
        ANALYZED,
        FINALIZED
    }

    struct EvidenceRecord {
        string evidenceID;
        bytes32 fileHash;
        string firebaseURL;
        address creator;
        address currentCustodian; // Tracks who currently holds the evidence
        uint256 timestamp;
        string evidenceType;
        EvidenceStatus status;
        address transferTo; // Temporary holding for intended recipient
    }

    mapping(string => EvidenceRecord) public vault;

    event EvidenceLogged(
        string indexed evidenceID,
        bytes32 indexed fileHash,
        address indexed officer,
        uint256 timestamp
    );

    event StatusUpdated(
        string indexed evidenceID,
        EvidenceStatus newStatus,
        address indexed updatedBy
    );

    event TransferRequested(
        string indexed evidenceID,
        address indexed from,
        address indexed to
    );

    event TransferAccepted(
        string indexed evidenceID,
        address indexed from,
        address indexed to
    );

    event ReportAdded(
        string indexed evidenceID,
        string reportHash,
        address indexed examiner,
        uint256 timestamp
    );

    event CaseFinalized(
        string indexed evidenceID,
        address indexed hod,
        uint256 timestamp
    );

    constructor() {
        // Grant the deployer (Super User) ALL roles for testing
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(HOD_ROLE, msg.sender);
        
        // Super-User Mode: One wallet to rule them all
        _grantRole(IO_ROLE, msg.sender);
        _grantRole(SO_ROLE, msg.sender);
        _grantRole(CUSTODIAN_ROLE, msg.sender);
        _grantRole(EXAMINER_ROLE, msg.sender);
    }

    function addEvidence(
        string memory _evidenceID,
        bytes32 _fileHash,
        string memory _firebaseURL,
        string memory _evidenceType
    ) public onlyRole(SO_ROLE) {
        require(vault[_evidenceID].timestamp == 0, "Evidence ID already exists");

        EvidenceRecord memory newRecord = EvidenceRecord({
            evidenceID: _evidenceID,
            fileHash: _fileHash,
            firebaseURL: _firebaseURL,
            creator: msg.sender,
            currentCustodian: msg.sender, // Initially held by the creator
            timestamp: block.timestamp,
            evidenceType: _evidenceType,
            status: EvidenceStatus.COLLECTED,
            transferTo: address(0)
        });

        vault[_evidenceID] = newRecord;

        emit EvidenceLogged(_evidenceID, _fileHash, msg.sender, block.timestamp);
    }

    /**
     * @dev Step 1 of Handshake: Current custodian requests to transfer to another address.
     */
    function requestTransfer(string memory _evidenceID, address _to) public {
        EvidenceRecord storage record = vault[_evidenceID];
        require(record.timestamp != 0, "Evidence does not exist");
        require(record.currentCustodian == msg.sender, "Caller is not the current custodian");
        require(_to != address(0), "Invalid recipient address");

        record.transferTo = _to;
        record.status = EvidenceStatus.IN_TRANSIT;

        emit TransferRequested(_evidenceID, msg.sender, _to);
        emit StatusUpdated(_evidenceID, EvidenceStatus.IN_TRANSIT, msg.sender);
    }

    /**
     * @dev Step 2 of Handshake: Intended recipient accepts the transfer.
     */
    function acceptTransfer(string memory _evidenceID) public {
        EvidenceRecord storage record = vault[_evidenceID];
        require(record.timestamp != 0, "Evidence does not exist");
        require(record.status == EvidenceStatus.IN_TRANSIT, "Evidence is not in transit");
        // Allow Intended Recipient OR Super User (Admin)
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            require(record.transferTo == msg.sender, "Caller is not the intended recipient");
        }

        address previousOwner = record.currentCustodian;
        record.currentCustodian = msg.sender;
        record.transferTo = address(0); // Clear the temporary field
        record.status = EvidenceStatus.SECURED;

        emit TransferAccepted(_evidenceID, previousOwner, msg.sender);
        emit StatusUpdated(_evidenceID, EvidenceStatus.SECURED, msg.sender);
    }

    // Layer 4: Forensic Analysis
    function addForensicReport(
        string memory _evidenceID,
        string memory _reportHash,
        string memory _reportURL
    ) public onlyRole(EXAMINER_ROLE) {
        EvidenceRecord storage record = vault[_evidenceID];
        require(record.timestamp != 0, "Evidence does not exist");
        require(record.status == EvidenceStatus.SECURED, "Evidence must be SECURED before analysis");
        
        // Update Status
        record.status = EvidenceStatus.ANALYZED;
        
        emit ReportAdded(_evidenceID, _reportHash, msg.sender, block.timestamp);
        emit StatusUpdated(_evidenceID, EvidenceStatus.ANALYZED, msg.sender);
    }

    // Layer 4: Master Audit & Finalization
    function finalizeCase(string memory _evidenceID) public onlyRole(HOD_ROLE) {
        EvidenceRecord storage record = vault[_evidenceID];
        require(record.timestamp != 0, "Evidence does not exist");
        require(record.status != EvidenceStatus.FINALIZED, "Case already finalized");

        record.status = EvidenceStatus.FINALIZED;
        
        emit CaseFinalized(_evidenceID, msg.sender, block.timestamp);
        emit StatusUpdated(_evidenceID, EvidenceStatus.FINALIZED, msg.sender);
    }

    // Helper to check standard status updates if needed (e.g. Analysis)
    function updateStatus(string memory _evidenceID, EvidenceStatus _newStatus) public {
        require(vault[_evidenceID].timestamp != 0, "Evidence does not exist");
        require(vault[_evidenceID].status != EvidenceStatus.FINALIZED, "Case is finalized and frozen");
        
        // Only allow specific roles to update status based on logic
        // For simplicity, we check if they are the current custodian or have specific roles
        // Here we restrict generic updates to the custodian
        require(vault[_evidenceID].currentCustodian == msg.sender, "Only current custodian can update status");

        vault[_evidenceID].status = _newStatus;
        emit StatusUpdated(_evidenceID, _newStatus, msg.sender);
    }

    function getEvidence(string memory _evidenceID) public view returns (EvidenceRecord memory) {
         require(vault[_evidenceID].timestamp != 0, "Evidence does not exist");
         return vault[_evidenceID];
    }
}
