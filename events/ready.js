/**
 * Ready Event Handler
 * 
 * This event is triggered when the Discord bot successfully connects
 * and is ready to start receiving events. This is where we set up
 * the bot's initial state and log important information.
 */

const logger = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true,  // This event should only run once when the bot starts
    
    /**
     * Execute function called when the bot is ready
     * @param {Client} client - Discord client instance
     */
    async execute(client) {
        try {
            // Log successful connection
            logger.info(`Successfully logged in as ${client.user.tag}`);
            logger.info(`Bot ID: ${client.user.id}`);
            logger.info(`Connected to ${client.guilds.cache.size} servers`);
            
            // Set bot activity/status
            const activities = [
                { name: 'RSS feeds', type: 'WATCHING' },
                { name: `${process.env.PREFIX || '!'}help for commands`, type: 'LISTENING' },
                { name: 'for new RSS updates', type: 'WATCHING' }
            ];
            
            // Set a random activity from the list
            const randomActivity = activities[Math.floor(Math.random() * activities.length)];
            await client.user.setActivity(randomActivity.name, { type: randomActivity.type });
            
            // Log guild information
            client.guilds.cache.forEach(guild => {
                logger.info(`Connected to guild: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);
            });
            
            // Log command count
            logger.info(`Loaded ${client.commands.size} commands`);
            
            // Performance logging
            const memoryUsage = process.memoryUsage();
            logger.debug('Memory usage:', {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
            });
            
            logger.info('CarterBot is ready and operational! 🤖');
            
        } catch (error) {
            logger.error('Error in ready event:', error);
        }
    }
};