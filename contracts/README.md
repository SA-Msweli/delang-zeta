# DeLangZeta Universal Smart Contract

This directory contains the Universal Smart Contract for the DeLangZeta platform, built on ZetaChain's omnichain infrastructure.

## Overview

The `DeLangZetaUniversal` contract is a single smart contract deployed on ZetaChain that can interact with Bitcoin, Ethereum, BSC, Polygon, and other connected chains. It provides:

- **Omnichain Task Creation**: Organizations can fund tasks using BTC, ETH, USDC, or any supported token
- **Cross-Chain Data Submission**: Contributors can submit data and receive rewards on their preferred network
- **Server-Side Validation**: Critical operations require server signatures for enhanced security
- **Universal Reward Distribution**: Automatic reward distribution across multiple chains

## Key Features

### 1. Server Signature Validation
All critical operations require server signatures to prevent abuse:
- Data submission validation
- Verification result processing
- User authentication challenges

### 2. Omnichain Payment Support
- Accept payments from Bitcoin, Ethereum, BSC, Polygon
- Distribute rewards to user's preferred network
- No manual bridging required

### 3. Cross-Chain State Management
- Unified task registry across all chains
- Universal user reputation system
- Cross-chain reward tracking

### 4. Security Features
- Reentrancy protection
- Access control with role-based permissions
- Cryptographic signature verification
- Nonce-based authentication

## Contract Structure

### Core Functions

#### Task Management
- `createTaskOmnichain()`: Create tasks with cross-chain payment support
- `getTask()`: Retrieve task details
- `setTaskActive()`: Pause/unpause tasks

#### Data Submission
- `submitDataOmnichainSecure()`: Submit data with server validation
- `getSubmission()`: Retrieve submission details
- `getTaskSubmissions()`: Get all submissions for a task

#### Authentication
- `generateUserAuthChallenge()`: Generate authentication challenges
- `validateUserAuthResponse()`: Validate user signatures
- `updateUserNonce()`: Update user nonce (server only)

#### Verification & Rewards
- `submitVerificationResultSecure()`: Process AI verification results
- Internal reward distribution with cross-chain support

### Events
- `TaskCreatedOmnichain`: Task creation with payment details
- `DataSubmittedOmnichain`: Data submission with preferred reward chain
- `SubmissionVerified`: Verification completion
- `RewardDistributedOmnichain`: Cross-chain reward distribution

## Setup

### Prerequisites
- Node.js v16+
- npm or yarn
- Hardhat

### Installation
```bash
cd contracts
npm install
```

### Configuration
1. Copy `.env.example` to `.env`
2. Set your private key and API keys:
```bash
PRIVATE_KEY=your_private_key_here
SERVER_ADDRESS=your_server_address_here
```

### Compilation
```bash
npm run compile
```

### Testing
```bash
npm run test
```

### Deployment

#### Local Testing
```bash
npx hardhat node
npm run deploy
```

#### ZetaChain Testnet
```bash
npx hardhat run scripts/deploy.js --network zetachain_testnet
```

#### ZetaChain Mainnet
```bash
npx hardhat run scripts/deploy.js --network zetachain_mainnet
```

## Testing

The contract includes comprehensive tests covering:

### Task Creation Tests
- Valid task creation with ETH payment
- Parameter validation (deadline, amounts, etc.)
- Payment validation (correct amounts)

### Data Submission Tests
- Valid submission with server signature
- Server signature validation
- Task status validation (active/inactive)
- Deadline enforcement

### Authentication Tests
- Challenge generation and validation
- User signature verification
- Nonce management

### Verification & Reward Tests
- AI verification result processing
- Reward distribution (same chain and cross-chain)
- Server signature validation for verification

### Access Control Tests
- Owner-only functions
- Task creator permissions
- Server-only operations

### Query Function Tests
- User task retrieval
- User submission retrieval
- Task submission listing

## Security Considerations

### Server Signature Validation
All critical operations require valid server signatures to prevent:
- Unauthorized data submissions
- Fake verification results
- Malicious reward claims

### Reentrancy Protection
All state-changing functions use `nonReentrant` modifier to prevent reentrancy attacks.

### Access Control
- Owner can update server address
- Task creators can pause their tasks
- Server can update user nonces and submit verification results

### Input Validation
- All parameters are validated before processing
- Deadline enforcement for tasks and submissions
- Payment amount verification

## Integration with Serverless Backend

The contract is designed to work with Google Cloud Functions for:

1. **Authentication**: Server validates wallet signatures and generates JWT tokens
2. **File Upload**: Server provides signed URLs for Google Cloud Storage
3. **AI Verification**: Server processes AI verification and submits results
4. **Cross-Chain Operations**: Server monitors and facilitates cross-chain transactions

## ZetaChain Integration

The contract leverages ZetaChain's omnichain capabilities:

1. **Universal Deployment**: Single contract handles all chains
2. **Cross-Chain Messaging**: Direct communication with external chains
3. **Universal Gas**: Users pay gas in their preferred tokens
4. **Omnichain State**: Unified state across all connected chains

## Deployment Addresses

### Testnet
- Contract: `TBD`
- SystemContract: `TBD`

### Mainnet
- Contract: `TBD`
- SystemContract: `TBD`

## License

MIT License - see LICENSE file for details.