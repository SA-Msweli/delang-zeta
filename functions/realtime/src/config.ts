import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export interface RealtimeConfig {
  jwtSecret: string;
  firestoreProjectId: string;
  pubsubTopicName: string;
  blockchainRpcUrls: {
    ethereum: string;
    zetachain: string;
    bsc: string;
    polygon: string;
  };
  contractAddresses: {
    universalContract: string;
  };
  notificationConfig: {
    vapidPublicKey: string;
    vapidPrivateKey: string;
    fcmServerKey: string;
  };
  rateLimits: {
    perUser: number;
    perIP: number;
    windowMs: number;
  };
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: RealtimeConfig | null = null;
  private secretClient: SecretManagerServiceClient;

  private constructor() {
    this.secretClient = new SecretManagerServiceClient();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  async getConfig(): Promise<RealtimeConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'delang-zeta';

      const [jwtSecretResponse] = await this.secretClient.accessSecretVersion({
        name: `projects/${projectId}/secrets/jwt-signing-key/versions/latest`,
      });

      const [vapidPublicResponse] = await this.secretClient.accessSecretVersion({
        name: `projects/${projectId}/secrets/vapid-public-key/versions/latest`,
      });

      const [vapidPrivateResponse] = await this.secretClient.accessSecretVersion({
        name: `projects/${projectId}/secrets/vapid-private-key/versions/latest`,
      });

      const [fcmServerKeyResponse] = await this.secretClient.accessSecretVersion({
        name: `projects/${projectId}/secrets/fcm-server-key/versions/latest`,
      });

      this.config = {
        jwtSecret: jwtSecretResponse.payload?.data?.toString() || '',
        firestoreProjectId: projectId,
        pubsubTopicName: 'delang-zeta-realtime-events',
        blockchainRpcUrls: {
          ethereum: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/your-key',
          zetachain: process.env.ZETACHAIN_RPC_URL || 'https://zetachain-evm.blockpi.network/v1/rpc/public',
          bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/',
          polygon: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com/'
        },
        contractAddresses: {
          universalContract: process.env.UNIVERSAL_CONTRACT_ADDRESS || '0x...'
        },
        notificationConfig: {
          vapidPublicKey: vapidPublicResponse.payload?.data?.toString() || '',
          vapidPrivateKey: vapidPrivateResponse.payload?.data?.toString() || '',
          fcmServerKey: fcmServerKeyResponse.payload?.data?.toString() || ''
        },
        rateLimits: {
          perUser: parseInt(process.env.RATE_LIMIT_PER_USER || '100'),
          perIP: parseInt(process.env.RATE_LIMIT_PER_IP || '1000'),
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') // 15 minutes
        }
      };

      return this.config;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw new Error('Configuration initialization failed');
    }
  }

  // Clear config cache for testing
  clearCache(): void {
    this.config = null;
  }
}

export const configManager = ConfigManager.getInstance();