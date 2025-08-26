// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title DeLangZetaUniversal
 * @dev Universal Smart Contract for DeLangZeta platform with omnichain capabilities
 * Handles task creation, data submission, and reward distribution across multiple chains
 */
contract DeLangZetaUniversal is ReentrancyGuard, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // System contract for ZetaChain operations (placeholder for testing)
    address public systemContract;

    // Server address for signature validation
    address public serverAddress;

    // Task counter for unique task IDs
    uint256 private taskCounter;

    // User nonce mapping for authentication challenges
    mapping(address => uint256) public userNonces;

    // Task structures
    struct TaskSpec {
        string title;
        string description;
        string language;
        string dataType; // 'text', 'audio', 'image', 'video'
        string criteria;
        uint256 rewardPerSubmission;
        uint256 totalReward;
        uint256 deadline;
        uint256 maxSubmissions;
        bool requiresValidation;
    }

    struct Task {
        string id;
        address creator;
        TaskSpec spec;
        uint256 sourceChainId;
        address paymentToken;
        uint256 totalFunded;
        uint256 remainingReward;
        uint256 submissionCount;
        bool active;
        uint256 createdAt;
    }

    struct Submission {
        string id;
        string taskId;
        address contributor;
        string storageUrl;
        string metadata;
        uint256 timestamp;
        uint256 preferredRewardChain;
        bool verified;
        uint256 qualityScore;
        bool rewarded;
    }

    // Storage mappings
    mapping(string => Task) public tasks;
    mapping(string => Submission) public submissions;
    mapping(string => string[]) public taskSubmissions; // taskId => submissionIds
    mapping(address => string[]) public userTasks; // creator => taskIds
    mapping(address => string[]) public userSubmissions; // contributor => submissionIds

    // Events
    event TaskCreatedOmnichain(
        string indexed taskId,
        address indexed creator,
        uint256 sourceChainId,
        uint256 totalReward,
        address paymentToken
    );

    event DataSubmittedOmnichain(
        string indexed submissionId,
        string indexed taskId,
        address indexed contributor,
        string storageUrl,
        uint256 preferredRewardChain
    );

    event SubmissionVerified(
        string indexed submissionId,
        uint256 qualityScore,
        bool approved
    );

    event RewardDistributedOmnichain(
        address indexed recipient,
        uint256 amount,
        address token,
        uint256 sourceChain,
        uint256 targetChain
    );

    event ServerAddressUpdated(
        address indexed oldServer,
        address indexed newServer
    );

    // Modifiers
    modifier onlyValidServer(
        bytes calldata serverSignature,
        bytes32 messageHash
    ) {
        require(
            ECDSA.recover(
                messageHash.toEthSignedMessageHash(),
                serverSignature
            ) == serverAddress,
            "Invalid server signature"
        );
        _;
    }

    modifier taskExists(string calldata taskId) {
        require(bytes(tasks[taskId].id).length > 0, "Task does not exist");
        _;
    }

    modifier submissionExists(string calldata submissionId) {
        require(
            bytes(submissions[submissionId].id).length > 0,
            "Submission does not exist"
        );
        _;
    }

    constructor(
        address _systemContract,
        address _serverAddress
    ) Ownable(msg.sender) {
        systemContract = _systemContract;
        serverAddress = _serverAddress;
        taskCounter = 0;
    }

    /**
     * @dev Create a new task with omnichain payment support
     * @param spec Task specification details
     * @param sourceChainId Chain ID where payment originates
     * @param paymentToken Token address for payment
     * @param amount Total payment amount
     */
    function createTaskOmnichain(
        TaskSpec calldata spec,
        uint256 sourceChainId,
        address paymentToken,
        uint256 amount
    ) external payable nonReentrant {
        require(amount > 0, "Payment amount must be greater than 0");
        require(
            spec.deadline > block.timestamp,
            "Deadline must be in the future"
        );
        require(
            spec.maxSubmissions > 0,
            "Max submissions must be greater than 0"
        );
        require(
            spec.rewardPerSubmission > 0,
            "Reward per submission must be greater than 0"
        );
        require(
            spec.rewardPerSubmission * spec.maxSubmissions <= amount,
            "Total reward exceeds payment amount"
        );

        // Generate unique task ID
        taskCounter++;
        string memory taskId = string(
            abi.encodePacked("task_", toString(taskCounter))
        );

        // Handle payment based on source chain
        if (sourceChainId == block.chainid) {
            // Same chain payment
            if (paymentToken == address(0)) {
                require(msg.value == amount, "Incorrect ETH amount");
            } else {
                // Handle ERC20 token payment
                require(
                    IERC20(paymentToken).transferFrom(
                        msg.sender,
                        address(this),
                        amount
                    ),
                    "Token transfer failed"
                );
            }
        } else {
            // Cross-chain payment - handled by ZetaChain protocol
            // Payment validation occurs through omnichain messaging
        }

        // Create task
        Task storage newTask = tasks[taskId];
        newTask.id = taskId;
        newTask.creator = msg.sender;
        newTask.spec = spec;
        newTask.sourceChainId = sourceChainId;
        newTask.paymentToken = paymentToken;
        newTask.totalFunded = amount;
        newTask.remainingReward = amount;
        newTask.submissionCount = 0;
        newTask.active = true;
        newTask.createdAt = block.timestamp;

        // Update user tasks
        userTasks[msg.sender].push(taskId);

        emit TaskCreatedOmnichain(
            taskId,
            msg.sender,
            sourceChainId,
            amount,
            paymentToken
        );
    }

    /**
     * @dev Submit data for a task with server signature validation
     * @param taskId Target task identifier
     * @param storageUrl URL where data is stored (Google Cloud Storage)
     * @param metadata JSON metadata about the submission
     * @param preferredRewardChain Chain where user wants to receive rewards
     * @param serverSignature Server signature validating the submission
     */
    function submitDataOmnichainSecure(
        string calldata taskId,
        string calldata storageUrl,
        string calldata metadata,
        uint256 preferredRewardChain,
        bytes calldata serverSignature
    ) external taskExists(taskId) nonReentrant {
        Task storage task = tasks[taskId];
        require(task.active, "Task is not active");
        require(
            block.timestamp <= task.spec.deadline,
            "Task deadline has passed"
        );
        require(
            task.submissionCount < task.spec.maxSubmissions,
            "Task submission limit reached"
        );

        // Validate server signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                taskId,
                storageUrl,
                metadata,
                preferredRewardChain,
                block.timestamp
            )
        );
        require(
            ECDSA.recover(
                messageHash.toEthSignedMessageHash(),
                serverSignature
            ) == serverAddress,
            "Invalid server signature"
        );

        // Generate unique submission ID
        string memory submissionId = string(
            abi.encodePacked(
                "sub_",
                taskId,
                "_",
                toString(task.submissionCount + 1)
            )
        );

        // Create submission
        Submission storage newSubmission = submissions[submissionId];
        newSubmission.id = submissionId;
        newSubmission.taskId = taskId;
        newSubmission.contributor = msg.sender;
        newSubmission.storageUrl = storageUrl;
        newSubmission.metadata = metadata;
        newSubmission.timestamp = block.timestamp;
        newSubmission.preferredRewardChain = preferredRewardChain;
        newSubmission.verified = false;
        newSubmission.qualityScore = 0;
        newSubmission.rewarded = false;

        // Update mappings
        taskSubmissions[taskId].push(submissionId);
        userSubmissions[msg.sender].push(submissionId);
        task.submissionCount++;

        emit DataSubmittedOmnichain(
            submissionId,
            taskId,
            msg.sender,
            storageUrl,
            preferredRewardChain
        );
    }

    /**
     * @dev Generate authentication challenge for user verification
     * @param user User address
     * @param nonce Current nonce for the user
     * @return challenge Generated challenge hash
     */
    function generateUserAuthChallenge(
        address user,
        uint256 nonce
    ) external view returns (bytes32 challenge) {
        return
            keccak256(
                abi.encodePacked(
                    "DeLangZeta_Auth_Challenge",
                    user,
                    nonce,
                    block.chainid,
                    address(this)
                )
            );
    }

    /**
     * @dev Validate user authentication response
     * @param user User address
     * @param challenge Challenge hash
     * @param signature User's signature of the challenge
     * @return valid Whether the signature is valid
     */
    function validateUserAuthResponse(
        address user,
        bytes32 challenge,
        bytes calldata signature
    ) external pure returns (bool valid) {
        return
            ECDSA.recover(challenge.toEthSignedMessageHash(), signature) ==
            user;
    }

    /**
     * @dev Update user nonce (called after successful authentication)
     * @param user User address
     */
    function updateUserNonce(address user) external {
        require(msg.sender == serverAddress, "Only server can update nonce");
        userNonces[user]++;
    }

    /**
     * @dev Submit verification result with server validation
     * @param submissionId Submission to verify
     * @param qualityScore AI-generated quality score (0-100)
     * @param approved Whether submission is approved
     * @param serverSignature Server signature validating the verification
     */
    function submitVerificationResultSecure(
        string calldata submissionId,
        uint256 qualityScore,
        bool approved,
        bytes calldata serverSignature
    ) external submissionExists(submissionId) nonReentrant {
        // Validate server signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                submissionId,
                qualityScore,
                approved,
                block.timestamp
            )
        );
        require(
            ECDSA.recover(
                messageHash.toEthSignedMessageHash(),
                serverSignature
            ) == serverAddress,
            "Invalid server signature"
        );

        Submission storage submission = submissions[submissionId];
        require(!submission.verified, "Submission already verified");

        submission.verified = true;
        submission.qualityScore = qualityScore;

        emit SubmissionVerified(submissionId, qualityScore, approved);

        // If approved, trigger reward distribution
        if (approved) {
            _distributeReward(submissionId);
        }
    }

    /**
     * @dev Internal function to distribute rewards
     * @param submissionId Submission to reward
     */
    function _distributeReward(string memory submissionId) internal {
        Submission storage submission = submissions[submissionId];
        Task storage task = tasks[submission.taskId];

        require(!submission.rewarded, "Reward already distributed");
        require(
            task.remainingReward >= task.spec.rewardPerSubmission,
            "Insufficient remaining reward"
        );

        submission.rewarded = true;
        task.remainingReward -= task.spec.rewardPerSubmission;

        // Handle cross-chain reward distribution
        if (submission.preferredRewardChain == block.chainid) {
            // Same chain reward
            if (task.paymentToken == address(0)) {
                payable(submission.contributor).transfer(
                    task.spec.rewardPerSubmission
                );
            } else {
                require(
                    IERC20(task.paymentToken).transfer(
                        submission.contributor,
                        task.spec.rewardPerSubmission
                    ),
                    "Token transfer failed"
                );
            }
        } else {
            // Cross-chain reward - use ZetaChain omnichain messaging
            _sendCrossChainReward(
                submission.contributor,
                task.spec.rewardPerSubmission,
                task.paymentToken,
                submission.preferredRewardChain
            );
        }

        emit RewardDistributedOmnichain(
            submission.contributor,
            task.spec.rewardPerSubmission,
            task.paymentToken,
            block.chainid,
            submission.preferredRewardChain
        );
    }

    /**
     * @dev Send cross-chain reward using ZetaChain protocol
     * @param recipient Reward recipient
     * @param amount Reward amount
     * @param token Token address
     * @param targetChain Target chain for reward
     */
    function _sendCrossChainReward(
        address recipient,
        uint256 amount,
        address token,
        uint256 targetChain
    ) internal {
        // Implementation depends on ZetaChain's specific omnichain messaging protocol
        // This would use ZetaChain's cross-chain communication to send rewards
        // to the user's preferred network (Bitcoin, Ethereum, BSC, etc.)
        // Placeholder for ZetaChain omnichain call
        // systemContract.depositAndCall(...);
    }

    /**
     * @dev Distribute rewards to multiple recipients with server validation
     * @param taskId Task identifier
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     * @param targetChains Array of target chains for each recipient
     * @param serverSignature Server signature validating the distribution
     */
    function distributeRewardsOmnichain(
        string calldata taskId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint256[] calldata targetChains,
        bytes calldata serverSignature
    ) external taskExists(taskId) nonReentrant {
        require(
            recipients.length == amounts.length,
            "Recipients and amounts length mismatch"
        );
        require(
            recipients.length == targetChains.length,
            "Recipients and target chains length mismatch"
        );
        require(recipients.length > 0, "No recipients specified");

        // Validate server signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                taskId,
                recipients,
                amounts,
                targetChains,
                block.timestamp
            )
        );
        require(
            ECDSA.recover(
                messageHash.toEthSignedMessageHash(),
                serverSignature
            ) == serverAddress,
            "Invalid server signature"
        );

        Task storage task = tasks[taskId];
        uint256 totalAmount = 0;

        // Calculate total amount
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(
            task.remainingReward >= totalAmount,
            "Insufficient remaining reward"
        );

        // Update remaining reward
        task.remainingReward -= totalAmount;

        // Distribute rewards
        for (uint256 i = 0; i < recipients.length; i++) {
            if (targetChains[i] == block.chainid) {
                // Same chain reward
                if (task.paymentToken == address(0)) {
                    payable(recipients[i]).transfer(amounts[i]);
                } else {
                    require(
                        IERC20(task.paymentToken).transfer(
                            recipients[i],
                            amounts[i]
                        ),
                        "Token transfer failed"
                    );
                }
            } else {
                // Cross-chain reward
                _sendCrossChainReward(
                    recipients[i],
                    amounts[i],
                    task.paymentToken,
                    targetChains[i]
                );
            }

            emit RewardDistributedOmnichain(
                recipients[i],
                amounts[i],
                task.paymentToken,
                block.chainid,
                targetChains[i]
            );
        }
    }

    /**
     * @dev Claim rewards with secure signature verification
     * @param taskId Task identifier
     * @param amount Amount to claim
     * @param targetChainId Target chain for reward
     * @param targetAddress Target address for reward
     * @param serverSignature Server signature validating the claim
     */
    function claimRewardsOmnichainSecure(
        string calldata taskId,
        uint256 amount,
        uint256 targetChainId,
        address targetAddress,
        bytes calldata serverSignature
    ) external taskExists(taskId) nonReentrant {
        // Validate server signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                taskId,
                amount,
                targetChainId,
                targetAddress,
                block.timestamp
            )
        );
        require(
            ECDSA.recover(
                messageHash.toEthSignedMessageHash(),
                serverSignature
            ) == serverAddress,
            "Invalid server signature"
        );

        Task storage task = tasks[taskId];
        require(
            task.remainingReward >= amount,
            "Insufficient remaining reward"
        );

        // Update remaining reward
        task.remainingReward -= amount;

        // Distribute reward
        if (targetChainId == block.chainid) {
            // Same chain reward
            if (task.paymentToken == address(0)) {
                payable(targetAddress).transfer(amount);
            } else {
                require(
                    IERC20(task.paymentToken).transfer(targetAddress, amount),
                    "Token transfer failed"
                );
            }
        } else {
            // Cross-chain reward
            _sendCrossChainReward(
                targetAddress,
                amount,
                task.paymentToken,
                targetChainId
            );
        }

        emit RewardDistributedOmnichain(
            targetAddress,
            amount,
            task.paymentToken,
            block.chainid,
            targetChainId
        );
    }

    /**
     * @dev Get reward calculation details for a task
     * @param taskId Task identifier
     * @return totalFunded Total amount funded for the task
     * @return remainingReward Remaining reward amount
     * @return distributedReward Amount already distributed
     * @return maxPossibleReward Maximum possible reward based on submissions
     */
    function getRewardCalculation(
        string calldata taskId
    )
        external
        view
        taskExists(taskId)
        returns (
            uint256 totalFunded,
            uint256 remainingReward,
            uint256 distributedReward,
            uint256 maxPossibleReward
        )
    {
        Task storage task = tasks[taskId];
        totalFunded = task.totalFunded;
        remainingReward = task.remainingReward;
        distributedReward = totalFunded - remainingReward;
        maxPossibleReward =
            task.spec.rewardPerSubmission *
            task.spec.maxSubmissions;
    }

    /**
     * @dev Get task details
     * @param taskId Task identifier
     * @return task Task details
     */
    function getTask(
        string calldata taskId
    ) external view returns (Task memory task) {
        return tasks[taskId];
    }

    /**
     * @dev Get submission details
     * @param submissionId Submission identifier
     * @return submission Submission details
     */
    function getSubmission(
        string calldata submissionId
    ) external view returns (Submission memory submission) {
        return submissions[submissionId];
    }

    /**
     * @dev Get task submissions
     * @param taskId Task identifier
     * @return submissionIds Array of submission IDs
     */
    function getTaskSubmissions(
        string calldata taskId
    ) external view returns (string[] memory submissionIds) {
        return taskSubmissions[taskId];
    }

    /**
     * @dev Get user tasks
     * @param user User address
     * @return taskIds Array of task IDs created by user
     */
    function getUserTasks(
        address user
    ) external view returns (string[] memory taskIds) {
        return userTasks[user];
    }

    /**
     * @dev Get user submissions
     * @param user User address
     * @return submissionIds Array of submission IDs by user
     */
    function getUserSubmissions(
        address user
    ) external view returns (string[] memory submissionIds) {
        return userSubmissions[user];
    }

    /**
     * @dev Update server address (only owner)
     * @param newServerAddress New server address
     */
    function updateServerAddress(address newServerAddress) external onlyOwner {
        require(newServerAddress != address(0), "Invalid server address");
        address oldServer = serverAddress;
        serverAddress = newServerAddress;
        emit ServerAddressUpdated(oldServer, newServerAddress);
    }

    /**
     * @dev Emergency pause/unpause task
     * @param taskId Task to pause/unpause
     * @param active New active status
     */
    function setTaskActive(string calldata taskId, bool active) external {
        Task storage task = tasks[taskId];
        require(
            msg.sender == task.creator || msg.sender == owner(),
            "Only task creator or owner can modify task"
        );
        task.active = active;
    }

    /**
     * @dev Convert uint to string
     * @param value Number to convert
     * @return String representation
     */
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @dev ZetaChain omnichain message handler (placeholder for testing)
     * @param zrc20 ZRC20 token address
     * @param amount Token amount
     * @param message Encoded message data
     */
    function onCrossChainCall(
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external {
        // Handle incoming cross-chain messages
        // This would process payments from other chains and trigger task creation
        // or reward distribution based on the message content
    }
}

// Interface for ERC20 tokens
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function balanceOf(address account) external view returns (uint256);
}
