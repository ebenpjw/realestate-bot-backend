# PropertyHub Command - Frontend

Apple-inspired frontend client system for multi-tenant real estate bot platform built with the latest technologies as of July 2025.

## 🚀 Features

### Agent Interface
- **Secure Authentication**: JWT-based login with role-based access control and automatic token refresh
- **Dashboard**: Lead overview, performance metrics, and quick actions with real-time updates
- **Conversations**: WhatsApp-style conversation history with real-time WebSocket updates
- **CRM**: Comprehensive lead management with advanced filtering and bulk operations
- **Analytics**: Individual performance metrics with AI-powered insights and recommendations
- **Testing**: Safe bot simulation interface without sending actual WhatsApp messages
- **Integrations**: Meta Business Account and WABA management with health monitoring

### Admin Interface
- **Multi-Agent Oversight**: System-wide dashboard with agent performance monitoring
- **Cost Tracking**: Usage analytics and billing management across all WABA instances
- **WABA Management**: Multiple WhatsApp Business account configuration and monitoring
- **System Health**: Real-time monitoring of all system components

### Technical Features
- **Real-time Updates**: WebSocket integration with automatic reconnection
- **Progressive Web App**: Mobile-optimized with offline capabilities and push notifications
- **Apple Design**: Clean, minimal interface following Apple Human Interface Guidelines
- **Meta Compliance**: Frontend-first approach optimized for Meta app review compliance
- **Accessibility**: WCAG 2.1 AA compliant with screen reader support
- **Performance**: Optimized with React Compiler and Partial Prerendering (PPR)

## 🛠 Technology Stack (July 2025)

- **Framework**: Next.js 15 with App Router and React 19
- **Language**: TypeScript 5.6 with strict configuration
- **Styling**: Tailwind CSS 4.0 with CSS-in-JS support
- **State Management**: TanStack Query v5 + Zustand 5.0
- **Real-time**: Socket.IO client 4.8 with automatic reconnection
- **UI Components**: Radix UI + Heroicons 2.1 + Custom design system
- **Forms**: React Hook Form 7.53 + Zod 3.23 validation
- **Animations**: Framer Motion 11.5 with layout animations
- **Notifications**: Sonner for modern toast notifications
- **Error Handling**: React Error Boundaries with Sentry integration
- **Testing**: Vitest + Testing Library + Playwright for E2E

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js 14 App Router
│   ├── auth/              # Authentication pages
│   ├── agent/             # Agent interface pages
│   ├── admin/             # Admin interface pages
│   ├── layout.tsx         # Root layout
│   └── providers.tsx      # Context providers
├── components/            # Reusable components
│   ├── agent/            # Agent-specific components
│   ├── admin/            # Admin-specific components
│   └── ui/               # Generic UI components
├── lib/                  # Utilities and configurations
│   ├── auth/             # Authentication logic
│   ├── api/              # API client and hooks
│   └── socket/           # WebSocket integration
├── public/               # Static assets
└── types/                # TypeScript type definitions
```

## 🚦 Getting Started

### Prerequisites
- **Node.js 22+** and **npm 10+** (or pnpm 9+ recommended)
- **Backend server** running on port 8080
- **Modern browser** with ES2022 support

### Installation

1. **Install dependencies** (using pnpm for better performance):
   ```bash
   cd frontend
   pnpm install
   ```

2. **Environment setup**:
   ```bash
   cp .env.example .env.local
   ```

   Configure environment variables:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   NEXT_PUBLIC_WS_URL=ws://localhost:8080
   NEXT_PUBLIC_APP_ENV=development
   ```

3. **Development server** with Turbopack:
   ```bash
   pnpm dev --turbo
   ```

4. **Open browser**: http://localhost:3000

### Demo Accounts
- **Agent**: `agent@demo.com` / `demo123`
- **Admin**: `admin@demo.com` / `demo123`

### Development Tools
- **React DevTools**: Browser extension for React debugging
- **TanStack Query DevTools**: Built-in query debugging
- **Next.js DevTools**: Built-in performance monitoring

## 🎨 Design System

### Apple-Inspired Principles
- **Clarity**: Clean, uncluttered interfaces
- **Deference**: Content takes priority over UI elements
- **Depth**: Visual layers and realistic motion

### Color Palette
- **Primary**: Blue (#3b82f6) for actions and focus
- **Gray Scale**: Neutral grays for text and backgrounds
- **Status Colors**: Green (success), Yellow (warning), Red (error)

### Typography
- **Font**: SF Pro Display system font stack
- **Hierarchy**: Clear typographic scale
- **Readability**: Optimized for all screen sizes

### Components
- **Buttons**: Rounded corners, subtle shadows, smooth transitions
- **Cards**: Clean white backgrounds with subtle borders
- **Forms**: Focused states with primary color highlights
- **Navigation**: Clear hierarchy with active states

## 🔐 Authentication Flow

1. **Login**: JWT token stored in localStorage
2. **Route Protection**: Automatic redirects based on authentication status
3. **Role-Based Access**: Agent vs Admin interface separation
4. **Token Refresh**: Automatic token renewal on API calls
5. **Logout**: Clean session termination

## 📡 API Integration

### Client Configuration
- **Base URL**: Configurable API endpoint
- **Authentication**: Automatic Bearer token injection
- **Error Handling**: Global error interceptors with user-friendly messages
- **Retry Logic**: Automatic retry for failed requests

### Real-time Features
- **WebSocket Connection**: Automatic connection management
- **Room Management**: User and role-specific rooms
- **Event Handling**: Real-time notifications and updates

## 📱 Mobile & PWA

### Responsive Design
- **Breakpoints**: Mobile-first responsive design
- **Touch Optimization**: Touch-friendly interface elements
- **Performance**: Optimized for mobile networks

### Progressive Web App
- **Installable**: Add to home screen capability
- **Offline Support**: Basic offline functionality
- **Push Notifications**: Real-time notification support

## 🧪 Testing

### Development Testing
```bash
npm run lint          # ESLint checking
npm run type-check    # TypeScript validation
npm run build         # Production build test
```

### Component Testing
- **Unit Tests**: Component behavior testing
- **Integration Tests**: API integration testing
- **E2E Tests**: Full user workflow testing

## 🚀 Deployment

### Build Process
```bash
npm run build         # Create production build
npm run start         # Start production server
```

### Environment Configuration
- **Production API**: Update NEXT_PUBLIC_API_URL
- **WebSocket URL**: Update NEXT_PUBLIC_WS_URL
- **Meta Compliance**: Ensure all Meta requirements are met

## 🔧 Development Guidelines

### Code Style
- **TypeScript**: Strict type checking enabled
- **ESLint**: Consistent code formatting
- **Prettier**: Automatic code formatting

### Component Structure
- **Functional Components**: React hooks pattern
- **Custom Hooks**: Reusable logic extraction
- **Context Providers**: Global state management

### Performance
- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js image optimization
- **Bundle Analysis**: Regular bundle size monitoring

## 📋 Roadmap

### Phase 1 (Current)
- ✅ Authentication system
- ✅ Agent dashboard
- ✅ Basic navigation
- 🔄 Conversation interface

### Phase 2
- 🔄 CRM lead management
- 🔄 Analytics dashboard
- 🔄 Testing interface

### Phase 3
- ⏳ Admin interface
- ⏳ Cost tracking
- ⏳ WABA management

### Phase 4
- ⏳ Real-time features
- ⏳ Mobile optimization
- ⏳ PWA features

## 🤝 Contributing

1. Follow the established code style
2. Write TypeScript with proper typing
3. Test components thoroughly
4. Follow Apple design principles
5. Ensure mobile responsiveness

## 📄 License

This project is part of the PropertyHub Command system.
