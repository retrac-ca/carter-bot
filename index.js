/**
 * CarterBot - Main Entry Point
 * 
 * This is the main file that initializes and starts the Discord bot.
 * It sets up the client, loads commands and events, and handles RSS feed monitoring.
 * 
 * Author: Your Name
 * License: AGPL-3.0
 */

// Import required modules
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import custom modules
const logger = require('./utils/logger');
const rssManager = require('./utils/rssManager');

/**
 * Create a new Discord client instance
 * GatewayIntentBits specify what events the bot can receive
 */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,              // Access to guild information
        GatewayIntentBits.GuildMessages,       // Access to guild messages
        GatewayIntentBits.MessageContent,      // Access to message content
        GatewayIntentBits.GuildMembers         // Access to guild member info
    ]
});

/**
 * Create collections to store commands and their cooldowns
 * Collections are Discord.js's way of storing key-value pairs
 */
client.commands = new Collection();
client.cooldowns = new Collection();

/**
 * Load all command files from the commands directory
 * This function recursively reads all subdirectories and loads command files
 */
function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    
    // Get all subdirectories in the commands folder
    const commandFolders = fs.readdirSync(commandsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    // Loop through each command folder (e.g., 'rss', 'general')
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        
        // Get all JavaScript files in the folder
        const commandFiles = fs.readdirSync(folderPath)
            .filter(file => file.endsWith('.js'));

        // Load each command file
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            
            try {
                const command = require(filePath);
                
                // Check if the command has required properties
                if (command.name && command.execute) {
                    client.commands.set(command.name, command);
                    logger.info(`Loaded command: ${command.name}`);
                } else {
                    logger.warn(`Command file ${file} is missing required properties (name, execute)`);
                }
            } catch (error) {
                logger.error(`Error loading command ${file}:`, error);
            }
        }
    }
}

/**
 * Load all event files from the events directory
 * Events handle Discord gateway events (ready, messageCreate, etc.)
 */
function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    
    // Get all JavaScript files in the events directory
    const eventFiles = fs.readdirSync(eventsPath)
        .filter(file => file.endsWith('.js'));

    // Load each event file
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        
        try {
            const event = require(filePath);
            
            // Check if the event has required properties
            if (event.name && event.execute) {
                // Register the event listener
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args, client));
                } else {
                    client.on(event.name, (...args) => event.execute(...args, client));
                }
                
                logger.info(`Loaded event: ${event.name}`);
            } else {
                logger.warn(`Event file ${file} is missing required properties (name, execute)`);
            }
        } catch (error) {
            logger.error(`Error loading event ${file}:`, error);
        }
    }
}

/**
 * Initialize the bot
 * This function sets up everything needed before the bot starts
 */
async function initialize() {
    try {
        logger.info('Initializing CarterBot...');
        
        // Load commands and events
        loadCommands();
        loadEvents();
        
        // Initialize RSS manager
        await rssManager.initialize();
        
        // Start RSS feed checking intervals
        rssManager.startFeedChecking(client);
        
        logger.info('Bot initialization completed');
        
    } catch (error) {
        logger.error('Failed to initialize bot:', error);
        process.exit(1);
    }
}

/**
 * Handle uncaught exceptions and unhandled promise rejections
 * This prevents the bot from crashing unexpectedly
 */
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

/**
 * Graceful shutdown handling
 * This ensures the bot shuts down cleanly when terminated
 */
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    
    // Stop RSS feed checking
    rssManager.stopFeedChecking();
    
    // Destroy the Discord client
    client.destroy();
    
    // Exit the process
    process.exit(0);
});

/**
 * Start the bot
 * This is the main entry point that gets everything running
 */
async function startBot() {
    // Check if bot token is provided
    if (!process.env.BOT_TOKEN) {
        logger.error('BOT_TOKEN not found in environment variables!');
        logger.error('Please create a .env file with your bot token:');
        logger.error('BOT_TOKEN=your_token_here');
        process.exit(1);
    }
    
    try {
        // Initialize everything
        await initialize();
        
        // Login to Discord
        await client.login(process.env.BOT_TOKEN);
        
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the bot
startBot();