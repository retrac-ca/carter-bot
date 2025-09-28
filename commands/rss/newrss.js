/**
 * New RSS Command
 * 
 * This command allows users to add a new RSS feed to the current channel.
 * The bot will automatically check this feed for updates and post new items.
 * 
 * Usage: !newrss <RSS_URL> [interval_in_minutes]
 * Example: !newrss https://example.com/feed.xml 15
 */

const { EmbedBuilder } = require('discord.js');
const rssManager = require('../../utils/rssManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'newrss',
    description: 'Add a new RSS feed to this channel',
    usage: '<RSS_URL> [interval_in_minutes]',
    aliases: ['addrss', 'rssnew'],
    category: 'rss',
    cooldown: 10, // 10 second cooldown to prevent spam
    guildOnly: true, // Can only be used in servers, not DMs
    permissions: ['ManageChannels'], // User needs manage channels permission
    args: true, // This command requires arguments
    
    /**
     * Execute the command
     * @param {Message} message - Discord message object
     * @param {Array} args - Command arguments
     * @param {Client} client - Discord client instance
     */
    async execute(message, args, client) {
        try {
            // Get the RSS URL from arguments
            const feedUrl = args[0];
            
            // Validate URL format (basic check)
            if (!this.isValidUrl(feedUrl)) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Invalid URL')
                    .setDescription('Please provide a valid RSS feed URL.')
                    .addFields({
                        name: 'Usage',
                        value: `\`${process.env.PREFIX || '!'}${this.name} ${this.usage}\``
                    })
                    .setTimestamp();
                
                return message.reply({ embeds: [errorEmbed] });
            }
            
            // Get optional interval (default to null for RSS manager default)
            let interval = null;
            if (args[1]) {
                const intervalMinutes = parseInt(args[1]);
                
                if (isNaN(intervalMinutes) || intervalMinutes < 1) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Invalid Interval')
                        .setDescription('Interval must be a positive number of minutes.')
                        .addFields({
                            name: 'Valid Range',
                            value: 'Minimum: 1 minute\nRecommended: 5-60 minutes'
                        })
                        .setTimestamp();
                    
                    return message.reply({ embeds: [errorEmbed] });
                }
                
                // Convert minutes to milliseconds
                interval = intervalMinutes * 60 * 1000;
                
                // Set reasonable limits
                if (intervalMinutes < 1) {
                    return message.reply('❌ Interval cannot be less than 1 minute.');
                }
                if (intervalMinutes > 1440) { // 24 hours
                    return message.reply('❌ Interval cannot be more than 24 hours (1440 minutes).');
                }
            }
            
            // Show loading message
            const loadingEmbed = new EmbedBuilder()
                .setColor(0xFFFF00)
                .setTitle('🔍 Validating RSS Feed')
                .setDescription('Please wait while we validate the RSS feed...')
                .setTimestamp();
            
            const loadingMessage = await message.reply({ embeds: [loadingEmbed] });
            
            // Add the RSS feed using the RSS manager
            const result = await rssManager.addFeed(message.channel.id, feedUrl, interval);
            
            if (result.success) {
                // Success embed
                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ RSS Feed Added Successfully')
                    .setDescription(`The RSS feed has been added to ${message.channel}.`)
                    .addFields(
                        {
                            name: '📰 Feed Title',
                            value: result.feedInfo.title || 'Unknown',
                            inline: true
                        },
                        {
                            name: '🔗 Feed URL',
                            value: feedUrl,
                            inline: false
                        },
                        {
                            name: '⏰ Check Interval',
                            value: `${Math.floor((result.feedInfo.interval || 300000) / 60000)} minutes`,
                            inline: true
                        },
                        {
                            name: '📝 Description',
                            value: result.feedInfo.description || 'No description available',
                            inline: false
                        }
                    )
                    .setFooter({
                        text: 'The bot will now check this feed for updates automatically.'
                    })
                    .setTimestamp();
                
                // Edit the loading message with success
                await loadingMessage.edit({ embeds: [successEmbed] });
                
                // Log the successful addition
                logger.logRSS('added', feedUrl, message.channel.id, `by ${message.author.tag}`);
                
            } else {
                // Error embed
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Failed to Add RSS Feed')
                    .setDescription(result.message)
                    .addFields({
                        name: '💡 Possible Issues',
                        value: '• URL might not be a valid RSS/Atom feed\n• Feed might be temporarily unavailable\n• You may have reached the maximum feeds limit\n• Feed might already exist in this channel'
                    })
                    .setFooter({
                        text: 'Try again with a different feed or contact an administrator.'
                    })
                    .setTimestamp();
                
                // Edit the loading message with error
                await loadingMessage.edit({ embeds: [errorEmbed] });
                
                // Log the failed attempt
                logger.logRSS('add-failed', feedUrl, message.channel.id, `${result.message} (by ${message.author.tag})`);
            }
            
        } catch (error) {
            logger.error('Error in newrss command:', error);
            
            // Error embed for unexpected errors
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Unexpected Error')
                .setDescription('An unexpected error occurred while adding the RSS feed.')
                .addFields({
                    name: '🔧 What to do',
                    value: 'Please try again in a few moments. If the problem persists, contact an administrator.'
                })
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }
    },
    
    /**
     * Basic URL validation
     * @param {string} url - URL to validate
     * @returns {boolean} True if URL appears valid
     */
    isValidUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }
};