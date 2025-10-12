# Shopping Agent - AI-Powered Mobile Phone Assistant

A simple AI-powered shopping assistant that helps users find the perfect mobile phone through natural language conversations.

## Features

- 🤖 **AI-Powered Responses** - Natural language conversations with Google's Gemini AI
- 📱 **Phone Database Integration** - Connected to Supabase for real phone data
- 🎯 **Context-Aware Selection** - Shows only relevant phone variants based on user intent
- 🔍 **Multi-Query Execution** - Parallel queries for comprehensive data coverage
- 🛡️ **Adversarial Protection** - Handles malicious queries gracefully
- 💬 **Simple Interface** - Clean input/output design
- 📱 **Mobile Responsive** - Optimized for all device sizes

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Generative AI (Gemini Pro)
- **Deployment**: Vercel (recommended)

## Project Structure

```
shopping-agent/
├── app/
│   ├── page.tsx              # Main application page with AI input
│   └── layout.tsx            # Root layout
├── components/
│   ├── MarkdownRenderer.tsx  # Custom markdown rendering with phone data formatting
│   ├── Sidebar.tsx           # Sidebar component for conversation history
│   └── DesktopSidebar.tsx   # Desktop-specific sidebar component
├── services/
│   ├── aiService.ts          # Google AI integration with context-aware selection
│   ├── phoneService.ts       # Database operations
│   └── queryService.ts       # AI-powered query generation
├── types/
│   └── index.ts              # TypeScript type definitions
├── lib/
│   └── supabase.ts           # Supabase client configuration
└── .env.local.example        # Environment variables template
```

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd shopping-agent
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Google AI Configuration
NEXT_PUBLIC_GOOGLE_AI_API_KEY=your_google_ai_api_key_here
```

### 4. Database Setup

Create the phones table in your Supabase database:

```sql
create table public.phones (
  id serial not null,
  brand text not null,
  model text not null,
  price integer not null,
  release_year integer null,
  os text null,
  ram text null,
  storage text null,
  display_type text null,
  display_size text null,
  resolution text null,
  refresh_rate integer null,
  camera_main text null,
  camera_front text null,
  camera_features text[] null,
  battery text null,
  charging text null,
  processor text null,
  connectivity text[] null,
  sensors text[] null,
  features text[] null,
  weight text null,
  dimensions text null,
  rating numeric null,
  stock_status text null,
  category text null,
  constraint phones_pkey primary key (id)
) TABLESPACE pg_default;
```

### 5. Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## API Keys Setup

### Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > API
4. Copy the URL and anon key

### Google AI

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Create a new API key
3. Copy the API key

## Usage Examples

### Sample Queries

- "Best camera phone under ₹30,000"
- "Compare iPhone 15 vs Samsung Galaxy S24"
- "Show me phones with 8GB RAM under ₹25,000"
- "What's the best gaming phone under ₹40,000?"
- "I need a phone with good battery life around ₹20,000"
- "Samsung S23 under 70k" (shows only variants under 70k)
- "Samsung S23 with 12GB RAM" (shows only 12GB variants)
- "Cheapest iPhone 15" (shows lowest-priced variant)

### Features Demonstrated

- **Natural Language Processing**: Understands complex queries
- **Context-Aware Selection**: Shows only relevant phone variants based on user intent
- **Multi-Query Execution**: Parallel queries for comprehensive data coverage
- **Smart Filtering**: Automatically extracts budget, brand, and feature requirements
- **Product Recommendations**: Suggests relevant phones with reasoning
- **Safety Handling**: Gracefully refuses inappropriate queries
- **Real-time Search**: Dynamic database queries based on user input

## Architecture Overview

### AI Service Layer

- Handles all Google AI interactions
- Implements context-aware phone selection based on user intent
- Supports multi-query execution for comprehensive data coverage
- Implements safety measures against adversarial prompts
- Extracts search filters from natural language
- Provides structured responses with proper formatting

### Phone Service Layer

- Manages all database operations
- Implements search and filtering logic
- Handles data formatting and validation
- Provides utility functions for price formatting
- Supports parallel query execution for better performance

### Component Architecture

- **ChatInterface**: Main conversation component with streaming responses
- **MarkdownRenderer**: Custom markdown rendering with phone data formatting
- **PhoneCard**: Reusable phone display component
- **Type Safety**: Comprehensive TypeScript definitions

## Key Features Explained

### Context-Aware Phone Selection

The system intelligently selects the most relevant phone variant based on user intent:

- **Budget Queries**: "Samsung S23 under 70k" → shows only variants under 70k
- **Spec Requirements**: "Samsung S23 with 12GB RAM" → shows only 12GB variants
- **Rating Queries**: "best Samsung S23" → shows highest-rated variant
- **Price Queries**: "cheapest Samsung S23" → shows lowest-priced variant

### Multi-Query Execution

For comprehensive data coverage, the system executes multiple related queries in parallel:

- **Brand Comparisons**: "Samsung vs Apple" → separate queries for each brand
- **Feature Queries**: "best camera phone" → queries for camera, rating, and performance
- **Budget Queries**: "phones under 30k" → queries for different price ranges and features

### Smart Data Consolidation

- Removes duplicate phones across multiple queries
- Consolidates RAM/storage options (e.g., "8GB, 12GB" instead of "8GB/12GB")
- Shows individual phone variants instead of artificially combined specs

## Safety & Security

### Adversarial Handling

The AI agent is designed to handle malicious queries:

- Refuses to reveal system prompts or API keys
- Avoids hallucinating specifications not in the database
- Maintains neutral, factual tone
- Rejects irrelevant or toxic requests

### Data Protection

- No user authentication required
- All data queries are read-only
- API keys are properly secured in environment variables

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms

- Netlify
- Railway
- Render
- Any Node.js hosting platform

## Known Limitations

1. **Database Dependency**: Requires populated phones table
2. **AI Model Limits**: Subject to Google AI API rate limits
3. **No User Accounts**: No personalization or saved preferences
4. **Static Data**: Phone data needs manual updates

## Future Enhancements

- [x] Context-aware phone selection based on user intent
- [x] Multi-query execution for comprehensive data coverage
- [x] Smart data consolidation and deduplication
- [x] Improved markdown rendering for phone specifications
- [ ] User authentication and preferences
- [ ] Real-time price updates
- [ ] Advanced comparison tools
- [ ] Wishlist functionality
- [ ] Mobile app version
- [ ] Multi-language support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:

- Create an issue in the GitHub repository
- Check the documentation
- Review the code comments

---

Built with ❤️ for the MyKaarma Assessment
