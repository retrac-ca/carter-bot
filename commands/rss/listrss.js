/**
 * List RSS Command
 * 
 * This command displays all RSS feeds currently configured for the channel.
 * It shows feed information including status, last check time, and intervals.
 * 
 * Usage: !listrss
 */

const { EmbedBuilder } = require('discord.js');
const rssManager = require('../../utils/rssManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'listrss',
    description: 'List all RSS feeds for this channel',
    aliases: ['rsslist', 'feeds'],
    category: 'rss',
    cooldown: 5,
    guildOnly: true,
    
    /**
     * Execute the command
     * @param {Message} message - Discord message object
     * @param {Array} args - Command arguments
     * @param {Client} client - Discord client instance
     */
    async execute(message, args, client) {
        try {
            // Get feeds for this channel
            const feeds = rssManager.getChannelFeeds(message.channel.id);
            
            if (feeds.length === 0) {
                const noFeedsEmbed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle('📰 RSS Feeds')
                    .setDescription(`No RSS feeds are configured for ${message.channel}.`)
                    .addFields({
                        name: '💡 Add a Feed',
                        value: `Use \`${process.env.PREFIX || '!'}newrss <URL>\` to add your first RSS feed!`
                    })
                    .setTimestamp();
                
                return message.reply({ embeds: [noFeedsEmbed] });
            }
            
            // Create embed with feed list
            const listEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📰 RSS Feeds')
                .setDescription(`${feeds.length} RSS feed(s) configured for ${message.channel}`)
                .setTimestamp();
            
            // Add each feed as a field (Discord embeds support up to 25 fields)
            const maxFields = Math.min(feeds.length, 25);
            
            for (let i = 0; i < maxFields; i++) {
                const feed = feeds[i];
                
                // Format last check time
                let lastChecked = 'Never';
                if (feed.lastChecked) {
                    const timeDiff = Date.now() - feed.lastChecked.getTime();
                    lastChecked = this.formatTimeDifference(timeDiff);
                }
                
                // Format interval
                const intervalMinutes = Math.floor(feed.interval / 60000);
                const intervalText = intervalMinutes >= 60 
                    ? `${Math.floor(intervalMinutes / 60)}h ${intervalMinutes % 60}m`
                    : `${intervalMinutes}m`;
                
                // Status indicator
                const statusIcon = feed.active ? '🟢' : '🔴';
                const statusText = feed.active ? 'Active' : 'Inactive';
                
                // Create field value
                const fieldValue = [
                    `**URL:** ${feed.url}`,
                    `**Status:** ${statusIcon} ${statusText}`,
                    `**Interval:** ${intervalText}`,
                    `**Last Check:** ${lastChecked}`,
                    feed.description ? `**Description:** ${this.truncateText(feed.description, 100)}` : ''
                ].filter(line => line).join('\n');
                
                listEmbed.addFields({
                    name: `${i + 1}. ${this.truncateText(feed.title, 50)}`,
                    value: fieldValue,
                    inline: false
                });
            }
            
            // Add footer if there are more feeds than displayed
            if (feeds.length > 25) {
                listEmbed.setFooter({
                    text: `Showing first 25 of ${feeds.length} feeds. Use dashboard for full list.`
                });
            } else {
                listEmbed.setFooter({
                    text: `Use ${process.env.PREFIX || '!'}removerss <URL> to remove a feed`
                });
            }
            
            return message.reply({ embeds: [listEmbed] });
            
        } catch (error) {
            logger.error('Error in listrss command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Error')
                .setDescription('An error occurred while retrieving RSS feeds.')
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }
    },
    
    /**
     * Format time difference in human-readable format
     * @param {number} timeDiff - Time difference in milliseconds
     * @returns {string} Formatted time string
     */
    formatTimeDifference(timeDiff) {
        const seconds = Math.floor(timeDiff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h ago`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m ago`;
        } else if (minutes > 0) {
            return `${minutes}m ago`;
        } else {
            return `${seconds}s ago`;
        }
    },
    
    /**
     * Truncate text to specified length
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated text
     */
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) {
            return text || 'No title';
        }
        return text.substring(0, maxLength - 3) + '...';
    }
};