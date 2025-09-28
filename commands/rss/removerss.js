/**
 * Remove RSS Command
 * 
 * This command allows users to remove an RSS feed from the current channel.
 * The bot will stop checking and posting updates from the specified feed.
 * 
 * Usage: !removerss <RSS_URL>
 * Example: !removerss https://example.com/feed.xml
 */

const { EmbedBuilder } = require('discord.js');
const rssManager = require('../../utils/rssManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'removerss',
    description: 'Remove an RSS feed from this channel',
    usage: '<RSS_URL>',
    aliases: ['delrss', 'rssrem'],
    category: 'rss',
    cooldown: 5,
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
            
            // Show loading message
            const loadingEmbed = new EmbedBuilder()
                .setColor(0xFFFF00)
                .setTitle('🔍 Removing RSS Feed')
                .setDescription('Please wait while we remove the RSS feed...')
                .setTimestamp();
            
            const loadingMessage = await message.reply({ embeds: [loadingEmbed] });
            
            // Remove the RSS feed using the RSS manager
            const result = await rssManager.removeFeed(message.channel.id, feedUrl);
            
            if (result.success) {
                // Success embed
                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ RSS Feed Removed Successfully')
                    .setDescription(`The RSS feed has been removed from ${message.channel}.`)
                    .addFields(
                        {
                            name: '🔗 Removed Feed',
                            value: feedUrl,
                            inline: false
                        },
                        {
                            name: '📊 Status',
                            value: 'The bot will no longer check this feed for updates.',
                            inline: false
                        }
                    )
                    .setFooter({
                        text: 'You can add this feed back anytime using the newrss command.'
                    })
                    .setTimestamp();
                
                // Edit the loading message with success
                await loadingMessage.edit({ embeds: [successEmbed] });
                
                // Log the successful removal
                logger.logRSS('removed', feedUrl, message.channel.id, `by ${message.author.tag}`);
                
            } else {
                // Error embed
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Failed to Remove RSS Feed')
                    .setDescription(result.message)
                    .addFields({
                        name: '💡 Possible Issues',
                        value: '• Feed URL might not exist in this channel\n• URL might be incorrect or mistyped\n• Feed might have already been removed'
                    })
                    .setFooter({
                        text: `Use ${process.env.PREFIX || '!'}listrss to see all active feeds in this channel.`
                    })
                    .setTimestamp();
                
                // Edit the loading message with error
                await loadingMessage.edit({ embeds: [errorEmbed] });
                
                // Log the failed attempt
                logger.logRSS('remove-failed', feedUrl, message.channel.id, `${result.message} (by ${message.author.tag})`);
            }
            
        } catch (error) {
            logger.error('Error in removerss command:', error);
            
            // Error embed for unexpected errors
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Unexpected Error')
                .setDescription('An unexpected error occurred while removing the RSS feed.')
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