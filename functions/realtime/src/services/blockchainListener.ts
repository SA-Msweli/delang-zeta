import { ethers } from 'ethers';
import { Firestore } from '@google-cloud/firestore';
import { configManager } from '../config';
import { BlockchainEvent, RealtimeEvent } from '../types';
import { realtimeSyncService } from './realtimeSync';

// Universal Smart Contract ABI (key events only)
const UNIVERSAL_CONTRACT_ABI = [
  'event TaskCreatedOmnichain(string indexed taskId, address indexed creator, uint256 sourceChainId, uint256 reward, address paymentToken)',
  'event DataSubmittedOmnichain(string indexed submissionId, address indexed contributor, string storageUrl, uint256 preferredRewardChain)',
  'event VerificationCompleteOmnichain(string indexed submissionId, uint256 finalScore, bool approved, address validator)',
  'event RewardDistributedOmnichain(address indexed recipient, uint256 amount, address token, uint256 sourceChain, uint256 targetChain)',
  'event CrossChainOperationComplete(bytes32 indexed operationId, uint256 sourceChain, uint256 targetChain, bool success)'
];

interface ChainConfig {
  name: string;
  rpcUrl: string;
  contractAddress: string;
  startBlock?: number;
}

export class BlockchainListenerService {
  private firestore: Firestore;
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private contracts: Map<string, ethers.Contract> = new Map();
  private listeners: Map<string, any[]> = new Map();
  private isRunning = false;

  constructor() {
    this.firestore = new Firestore();
  }

  async initialize(): Promise<void> {
    try {
      const config = await configManager.getConfig();

      const chains: ChainConfig[] = [
        {
          name: 'ethereum',
          rpcUrl: config.blockchainRpcUrls.ethereum,
          contractAddress: config.contractAddresses.universalContract
        },
        {
          name: 'zetachain',
          rpcUrl: config.blockchainRpcUrls.zetachain,
          contractAddress: config.contractAddresses.universalContract
        },
        {
          name: 'bsc',
          rpcUrl: config.blockchainRpcUrls.bsc,
          contractAddress: config.contractAddresses.universalContract
        },
        {
          name: 'polygon',
          rpcUrl: config.blockchainRpcUrls.polygon,
          contractAddress: config.contractAddresses.universalContract
        }
      ];

      // Initialize providers and contracts for each chain
      for (const chain of chains) {
        try {
          const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
          const contract = new ethers.Contract(
            chain.contractAddress,
            UNIVERSAL_CONTRACT_ABI,
            provider
          );

          this.providers.set(chain.name, provider);
          this.contracts.set(chain.name, contract);

          console.log(`Initialized blockchain listener for ${chain.name}`);
        } catch (error) {
          console.error(`Failed to initialize ${chain.name} listener:`, error);
        }
      }

      await realtimeSyncService.initialize();
    } catch (error) {
      console.error('Failed to initialize BlockchainListenerService:', error);
      throw error;
    }
  }

  async startListening(): Promise<void> {
    if (this.isRunning) {
      console.log('Blockchain listeners already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting blockchain event listeners...');

    for (const [chainName, contract] of this.contracts) {
      try {
        await this.setupChainListeners(chainName, contract);
      } catch (error) {
        console.error(`Failed to setup listeners for ${chainName}:`, error);
      }
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('Stopping blockchain event listeners...');

    // Remove all listeners
    for (const [chainName, listeners] of this.listeners) {
      const contract = this.contracts.get(chainName);
      if (contract) {
        listeners.forEach(listener => {
          contract.off(listener.event, listener.callback);
        });
      }
    }

    this.listeners.clear();
  }

  private async setupChainListeners(chainName: string, contract: ethers.Contract): Promise<void> {
    const chainListeners: any[] = [];

    try {
      // Task Created Event
      const taskCreatedListener = async (
        taskId: string,
        creator: string,
        sourceChainId: bigint,
        reward: bigint,
        paymentToken: string,
        event: any
      ) => {
        await this.handleTaskCreatedEvent({
          taskId,
          creator,
          sourceChainId: sourceChainId.toString(),
          reward: reward.toString(),
          paymentToken,
          chainName,
          event
        });
      };

      contract.on('TaskCreatedOmnichain', taskCreatedListener);
      chainListeners.push({ event: 'TaskCreatedOmnichain', callback: taskCreatedListener });

      // Data Submitted Event
      const dataSubmittedListener = async (
        submissionId: string,
        contributor: string,
        storageUrl: string,
        preferredRewardChain: bigint,
        event: any
      ) => {
        await this.handleDataSubmittedEvent({
          submissionId,
          contributor,
          storageUrl,
          preferredRewardChain: preferredRewardChain.toString(),
          chainName,
          event
        });
      };

      contract.on('DataSubmittedOmnichain', dataSubmittedListener);
      chainListeners.push({ event: 'DataSubmittedOmnichain', callback: dataSubmittedListener });

      // Verification Complete Event
      const verificationCompleteListener = async (
        submissionId: string,
        finalScore: bigint,
        approved: boolean,
        validator: string,
        event: any
      ) => {
        await this.handleVerificationCompleteEvent({
          submissionId,
          finalScore: finalScore.toString(),
          approved,
          validator,
          chainName,
          event
        });
      };

      contract.on('VerificationCompleteOmnichain', verificationCompleteListener);
      chainListeners.push({ event: 'VerificationCompleteOmnichain', callback: verificationCompleteListener });

      // Reward Distributed Event
      const rewardDistributedListener = async (
        recipient: string,
        amount: bigint,
        token: string,
        sourceChain: bigint,
        targetChain: bigint,
        event: any
      ) => {
        await this.handleRewardDistributedEvent({
          recipient,
          amount: amount.toString(),
          token,
          sourceChain: sourceChain.toString(),
          targetChain: targetChain.toString(),
          chainName,
          event
        });
      };

      contract.on('RewardDistributedOmnichain', rewardDistributedListener);
      chainListeners.push({ event: 'RewardDistributedOmnichain', callback: rewardDistributedListener });

      // Cross Chain Operation Complete Event
      const crossChainCompleteListener = async (
        operationId: string,
        sourceChain: bigint,
        targetChain: bigint,
        success: boolean,
        event: any
      ) => {
        await this.handleCrossChainCompleteEvent({
          operationId,
          sourceChain: sourceChain.toString(),
          targetChain: targetChain.toString(),
          success,
          chainName,
          event
        });
      };

      contract.on('CrossChainOperationComplete', crossChainCompleteListener);
      chainListeners.push({ event: 'CrossChainOperationComplete', callback: crossChainCompleteListener });

      this.listeners.set(chainName, chainListeners);
      console.log(`Set up ${chainListeners.length} event listeners for ${chainName}`);
    } catch (error) {
      console.error(`Failed to setup listeners for ${chainName}:`, error);
    }
  }

  private async handleTaskCreatedEvent(data: any): Promise<void> {
    try {
      const blockchainEvent: BlockchainEvent = {
        eventType: 'TaskCreatedOmnichain',
        contractAddress: data.event.address,
        blockNumber: data.event.blockNumber,
        transactionHash: data.event.transactionHash,
        logIndex: data.event.logIndex,
        data: {
          taskId: data.taskId,
          creator: data.creator,
          sourceChainId: data.sourceChainId,
          reward: data.reward,
          paymentToken: data.paymentToken,
          chainName: data.chainName
        },
        timestamp: new Date()
      };

      await this.storeBlockchainEvent(blockchainEvent);

      // Create realtime event for users
      const realtimeEvent: RealtimeEvent = {
        id: `task_created_${data.taskId}_${Date.now()}`,
        type: 'task_update',
        taskId: data.taskId,
        data: {
          action: 'created',
          taskId: data.taskId,
          creator: data.creator,
          reward: data.reward,
          paymentToken: data.paymentToken,
          sourceChain: data.sourceChainId
        },
        timestamp: new Date(),
        priority: 'medium'
      };

      await realtimeSyncService.publishEvent(realtimeEvent);

      console.log(`Processed TaskCreated event for task: ${data.taskId}`);
    } catch (error) {
      console.error('Failed to handle TaskCreated event:', error);
    }
  }

  private async handleDataSubmittedEvent(data: any): Promise<void> {
    try {
      const blockchainEvent: BlockchainEvent = {
        eventType: 'DataSubmittedOmnichain',
        contractAddress: data.event.address,
        blockNumber: data.event.blockNumber,
        transactionHash: data.event.transactionHash,
        logIndex: data.event.logIndex,
        data: {
          submissionId: data.submissionId,
          contributor: data.contributor,
          storageUrl: data.storageUrl,
          preferredRewardChain: data.preferredRewardChain,
          chainName: data.chainName
        },
        timestamp: new Date()
      };

      await this.storeBlockchainEvent(blockchainEvent);

      // Create realtime event for the contributor
      const realtimeEvent: RealtimeEvent = {
        id: `submission_created_${data.submissionId}_${Date.now()}`,
        type: 'submission_update',
        userId: data.contributor, // Assuming wallet address as userId
        submissionId: data.submissionId,
        data: {
          action: 'submitted',
          submissionId: data.submissionId,
          contributor: data.contributor,
          storageUrl: data.storageUrl,
          preferredRewardChain: data.preferredRewardChain
        },
        timestamp: new Date(),
        priority: 'medium'
      };

      await realtimeSyncService.publishEvent(realtimeEvent);

      console.log(`Processed DataSubmitted event for submission: ${data.submissionId}`);
    } catch (error) {
      console.error('Failed to handle DataSubmitted event:', error);
    }
  }

  private async handleVerificationCompleteEvent(data: any): Promise<void> {
    try {
      const blockchainEvent: BlockchainEvent = {
        eventType: 'VerificationCompleteOmnichain',
        contractAddress: data.event.address,
        blockNumber: data.event.blockNumber,
        transactionHash: data.event.transactionHash,
        logIndex: data.event.logIndex,
        data: {
          submissionId: data.submissionId,
          finalScore: data.finalScore,
          approved: data.approved,
          validator: data.validator,
          chainName: data.chainName
        },
        timestamp: new Date()
      };

      await this.storeBlockchainEvent(blockchainEvent);

      // Get submission details to find the contributor
      const submissionDoc = await this.firestore
        .collection('submissions')
        .doc(data.submissionId)
        .get();

      const submissionData = submissionDoc.data();
      const contributorId = submissionData?.contributor;

      // Create realtime event for the contributor
      const realtimeEvent: RealtimeEvent = {
        id: `verification_complete_${data.submissionId}_${Date.now()}`,
        type: 'validation_update',
        userId: contributorId,
        submissionId: data.submissionId,
        data: {
          action: 'verification_complete',
          submissionId: data.submissionId,
          finalScore: data.finalScore,
          approved: data.approved,
          validator: data.validator
        },
        timestamp: new Date(),
        priority: 'high'
      };

      await realtimeSyncService.publishEvent(realtimeEvent);

      console.log(`Processed VerificationComplete event for submission: ${data.submissionId}`);
    } catch (error) {
      console.error('Failed to handle VerificationComplete event:', error);
    }
  }

  private async handleRewardDistributedEvent(data: any): Promise<void> {
    try {
      const blockchainEvent: BlockchainEvent = {
        eventType: 'RewardDistributedOmnichain',
        contractAddress: data.event.address,
        blockNumber: data.event.blockNumber,
        transactionHash: data.event.transactionHash,
        logIndex: data.event.logIndex,
        data: {
          recipient: data.recipient,
          amount: data.amount,
          token: data.token,
          sourceChain: data.sourceChain,
          targetChain: data.targetChain,
          chainName: data.chainName
        },
        timestamp: new Date()
      };

      await this.storeBlockchainEvent(blockchainEvent);

      // Create realtime event for the recipient
      const realtimeEvent: RealtimeEvent = {
        id: `reward_distributed_${data.recipient}_${Date.now()}`,
        type: 'reward_distributed',
        userId: data.recipient,
        data: {
          action: 'reward_distributed',
          recipient: data.recipient,
          amount: data.amount,
          token: data.token,
          sourceChain: data.sourceChain,
          targetChain: data.targetChain,
          transactionHash: data.event.transactionHash
        },
        timestamp: new Date(),
        priority: 'high'
      };

      await realtimeSyncService.publishEvent(realtimeEvent);

      console.log(`Processed RewardDistributed event for recipient: ${data.recipient}`);
    } catch (error) {
      console.error('Failed to handle RewardDistributed event:', error);
    }
  }

  private async handleCrossChainCompleteEvent(data: any): Promise<void> {
    try {
      const blockchainEvent: BlockchainEvent = {
        eventType: 'CrossChainOperationComplete',
        contractAddress: data.event.address,
        blockNumber: data.event.blockNumber,
        transactionHash: data.event.transactionHash,
        logIndex: data.event.logIndex,
        data: {
          operationId: data.operationId,
          sourceChain: data.sourceChain,
          targetChain: data.targetChain,
          success: data.success,
          chainName: data.chainName
        },
        timestamp: new Date()
      };

      await this.storeBlockchainEvent(blockchainEvent);

      // Create realtime event for cross-chain operation status
      const realtimeEvent: RealtimeEvent = {
        id: `crosschain_complete_${data.operationId}_${Date.now()}`,
        type: 'blockchain_event',
        data: {
          action: 'crosschain_operation_complete',
          operationId: data.operationId,
          sourceChain: data.sourceChain,
          targetChain: data.targetChain,
          success: data.success,
          transactionHash: data.event.transactionHash
        },
        timestamp: new Date(),
        priority: 'medium'
      };

      await realtimeSyncService.publishEvent(realtimeEvent);

      console.log(`Processed CrossChainComplete event for operation: ${data.operationId}`);
    } catch (error) {
      console.error('Failed to handle CrossChainComplete event:', error);
    }
  }

  private async storeBlockchainEvent(event: BlockchainEvent): Promise<void> {
    try {
      const eventId = `${event.transactionHash}_${event.logIndex}`;

      await this.firestore
        .collection('blockchain_events')
        .doc(eventId)
        .set({
          ...event,
          id: eventId,
          processed: true,
          createdAt: new Date()
        });

      console.log(`Stored blockchain event: ${event.eventType}`);
    } catch (error) {
      console.error('Failed to store blockchain event:', error);
    }
  }

  async getEventHistory(
    eventType?: string,
    fromBlock?: number,
    toBlock?: number,
    limit = 100
  ): Promise<BlockchainEvent[]> {
    try {
      let query = this.firestore
        .collection('blockchain_events')
        .orderBy('blockNumber', 'desc')
        .limit(limit);

      if (eventType) {
        query = query.where('eventType', '==', eventType);
      }

      if (fromBlock) {
        query = query.where('blockNumber', '>=', fromBlock);
      }

      if (toBlock) {
        query = query.where('blockNumber', '<=', toBlock);
      }

      const snapshot = await query.get();
      const events: BlockchainEvent[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        events.push({
          eventType: data.eventType,
          contractAddress: data.contractAddress,
          blockNumber: data.blockNumber,
          transactionHash: data.transactionHash,
          logIndex: data.logIndex,
          data: data.data,
          timestamp: data.timestamp.toDate()
        });
      });

      return events;
    } catch (error) {
      console.error('Failed to get event history:', error);
      return [];
    }
  }
}

export const blockchainListenerService = new BlockchainListenerService();