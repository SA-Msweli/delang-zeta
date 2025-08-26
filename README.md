# DeLangZeta - Decentralized Language Data Platform

DeLangZeta is a Web3-native platform built on ZetaChain's Universal Smart Contracts that revolutionizes AI language data collection. Contributors earn rewards for high-quality language data while organizations access diverse, verified datasets for AI training.

## 🌟 Key Features

- **Omnichain Payments**: Pay and receive rewards in BTC, ETH, USDC, or any supported token
- **AI-Powered Verification**: Google Gemini 2.5 Flash ensures data quality
- **Secure Serverless Architecture**: Google Cloud Functions for scalability
- **Mobile-First Design**: Responsive interface optimized for all devices
- **Community Governance**: Decentralized decision-making through DAO voting

## 🏗️ Architecture

### Frontend
- React 18 with TypeScript
- Tailwind CSS for responsive design
- Wagmi + RainbowKit for Web3 integration
- Vite for fast development and building

### Backend
- Google Cloud Functions for all serverless API endpoints
- Google Cloud Storage for secure file operations  
- Secret Manager for secure API key storage
- Firestore for real-time data synchronization

### Blockchain
- ZetaChain Universal Smart Contracts
- Cross-chain compatibility (Bitcoin, Ethereum, BSC, Polygon)
- Omnichain payment and reward distribution

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google Cloud SDK
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/delang-zeta.git
   cd delang-zeta
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up Google Cloud**
   ```bash
   # Make setup scripts executable
   chmod +x gcp/iam-setup.sh
   chmod +x gcp/secret-manager-setup.sh
   
   # Run setup scripts
   ./gcp/iam-setup.sh your-project-id
   ./gcp/secret-manager-setup.sh your-project-id
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

### Deploy Cloud Functions

1. **Build and deploy authentication function**
   ```bash
   cd functions/auth
   npm install
   npm run build
   npm run deploy
   ```

2. **Deploy additional Cloud Functions**
   ```bash
   # Deploy task management functions
   cd functions/tasks
   npm install
   npm run deploy
   
   # Deploy file management functions  
   cd ../files
   npm install
   npm run deploy
   
   # Deploy reward functions
   cd ../rewards
   npm install
   npm run deploy
   ```

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Run ESLint

### Project Structure

```
delang-zeta/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── config/            # Configuration files
│   └── hooks/             # Custom React hooks
├── functions/             # Google Cloud Functions
│   ├── ai/                # AI validation functions
│   ├── auth/              # Authentication functions
│   ├── tasks/             # Task management functions
│   ├── files/             # File management functions
│   ├── rewards/           # Reward distribution functions
│   └── blockchain/        # Blockchain interaction functions
├── gcp/                   # Google Cloud setup scripts
└── public/                # Static assets
```

## 🔐 Security Features

- **JWT Authentication**: Secure wallet-based authentication
- **Server-side Validation**: All critical operations validated server-side
- **IAM Controls**: Granular Google Cloud permissions
- **Secret Management**: Secure API key storage
- **Audit Logging**: Comprehensive security event logging

## 🌐 Supported Networks

- **ZetaChain** (Primary)
- **Bitcoin**
- **Ethereum**
- **Binance Smart Chain**
- **Polygon**

## 📱 Mobile Support

- Progressive Web App (PWA) capabilities
- Touch-optimized interface
- Mobile wallet integration
- Offline functionality
- Responsive design for all screen sizes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Documentation: [docs.delangzeta.com](https://docs.delangzeta.com)
- Discord: [discord.gg/delangzeta](https://discord.gg/delangzeta)
- Email: support@delangzeta.com

## 🙏 Acknowledgments

- ZetaChain for Universal Smart Contract technology
- Google Cloud for serverless infrastructure
- RainbowKit for Web3 wallet integration
- The open-source community for amazing tools and libraries