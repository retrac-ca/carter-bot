# CarterBot - RSS Discord Bot with Web Dashboard

## Overview
CarterBot is a Discord bot that automatically posts RSS feed updates to specified channels. It includes a web-based dashboard for easy management of feeds without touching code.

## Features
- **RSS Feed Management**: Add, remove, and monitor RSS feeds
- **Dynamic Feed Addition**: Use `!newrss <URL>` command to add feeds
- **Web Dashboard**: Browser-based interface for feed management
- **Channel-Specific Feeds**: Assign feeds to specific Discord channels
- **Automatic Updates**: Configurable intervals for feed checking
- **Error Handling**: Robust error management and retry mechanisms

## Installation

### Prerequisites
- Node.js (v16 or higher)
- A Discord Application/Bot Token
- Administrator permissions on your Discord server

### Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/retrac-ca/carterBot.git
   cd carterBot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   BOT_TOKEN=your_bot_token_here
   PREFIX=!
   DASHBOARD_PORT=3000
   ```

4. **Start the Bot**
   ```bash
   # For production
   npm start
   
   # For development (with auto-restart)
   npm run dev
   ```

5. **Start the Web Dashboard** (Optional)
   ```bash
   npm run dashboard
   ```
   Access the dashboard at `http://localhost:3000`

## Bot Commands

### RSS Management
- `!newrss <URL>` - Add a new RSS feed to the current channel
- `!removerss <URL>` - Remove an RSS feed from the current channel
- `!listrss` - List all RSS feeds for the current channel
- `!checkrss` - Manually check all feeds for updates

### General Commands
- `!help` - Display available commands
- `!ping` - Check bot response time
- `!info` - Display bot information

## Directory Structure

```
carterBot/
├── commands/           # Bot commands
│   ├── rss/           # RSS-related commands
│   └── general/       # General bot commands
├── events/            # Discord event handlers
├── handlers/          # Command and event handlers
├── utils/             # Utility functions
├── data/              # Data storage (feeds, settings)
├── dashboard/         # Web dashboard files
│   ├── public/        # Static files (CSS, JS, images)
│   ├── views/         # HTML templates
│   └── routes/        # API endpoints
├── logs/              # Log files
├── .env               # Environment variables (create this)
├── .gitignore         # Git ignore file
├── index.js           # Main bot file
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Web Dashboard

The web dashboard provides a user-friendly interface to:
- Add and remove RSS feeds
- Assign feeds to specific channels
- Monitor feed status and last update times
- Configure update intervals
- View feed history and statistics

Access the dashboard at `http://localhost:3000` after starting it with `npm run dashboard`.

## Configuration

### Feed Settings
Feeds are stored in `data/feeds.json` with the following structure:
```json
{
  "channelId": {
    "feedUrl": {
      "url": "https://example.com/feed.xml",
      "interval": 300000,
      "lastChecked": "2023-01-01T00:00:00.000Z",
      "lastPostId": "post-id",
      "active": true
    }
  }
}
```

### Bot Settings
Bot configuration is stored in `data/config.json`:
```json
{
  "defaultInterval": 300000,
  "maxFeedsPerChannel": 10,
  "enableWebDashboard": true,
  "logLevel": "info"
}
```

## Development

### Code Structure
The bot is built with modularity in mind:
- **Commands**: Each command is in its own file with proper documentation
- **Events**: Discord events are handled in separate modules
- **Handlers**: Dynamic loading of commands and events
- **Utils**: Shared utility functions for RSS parsing, logging, etc.

### Adding New Commands
1. Create a new file in the appropriate `commands/` subdirectory
2. Follow the command template structure
3. The command handler will automatically load it

### RSS Feed Processing
The bot checks RSS feeds at configurable intervals:
1. Fetches the RSS feed using `rss-parser`
2. Compares with the last known post ID
3. Posts new items to the assigned Discord channel
4. Updates the last known post ID

## Security Considerations
- Bot token is stored in environment variables
- Web dashboard includes basic security headers
- Input validation on all user inputs
- Rate limiting to comply with Discord API limits

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes with proper documentation
4. Test thoroughly
5. Submit a pull request

## License
This project is licensed under the AGPL-3.0 License - see the LICENSE file for details.

## Support
For questions, issues, or contributions:
- Create an issue on GitHub
- Check existing documentation
- Review the code comments for implementation details

## Version History
- **v1.0.0**: Initial release with basic RSS functionality and web dashboard
- Features planned for future versions:
  - Advanced filtering options
  - Custom embed formatting
  - Multi-server support
  - Feed categories and tags