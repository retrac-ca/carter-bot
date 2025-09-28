/**
 * Ping Command
 * 
 * This command tests the bot's response time and shows both
 * the bot latency (time to process and respond) and the
 * WebSocket ping to Discord's API.
 * 
 * Usage: !ping
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
    name: 'ping',
    description: 'Check bot response time and API latency',
    category: 'general',
    cooldown: 3,
    
    /**
     * Execute the command
     * @param {Message} message - Discord message object
     * @param {Array} args - Command arguments (unused for ping)
     * @param {Client} client - Discord client instance
     */
    async execute(message, args, client) {
        try {
            // Calculate bot latency (time taken to process and respond)
            const botLatency = Date.now() - message.createdTimestamp;
            
            // Get WebSocket ping to Discord API
            const apiLatency = client.ws.ping;
            
            // Determine connection quality based on latency
            let connectionQuality = '🟢 Excellent';
            let color = 0x00FF00; // Green
            
            if (botLatency > 200 || apiLatency > 200) {
                connectionQuality = '🟡 Good';
                color = 0xFFFF00; // Yellow
            }
            
            if (botLatency > 500 || apiLatency > 500) {
                connectionQuality = '🟠 Fair';
                color = 0xFF8000; // Orange
            }
            
            if (botLatency > 1000 || apiLatency > 1000) {
                connectionQuality = '🔴 Poor';
                color = 0xFF0000; // Red
            }
            
            // Create response embed
            const pingEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle('🏓 Pong!')
                .setDescription('Bot response time and connection information')
                .addFields(
                    {
                        name: '🤖 Bot Latency',
                        value: `${botLatency}ms`,
                        inline: true
                    },
                    {
                        name: '🌐 API Latency',
                        value: `${apiLatency}ms`,
                        inline: true
                    },
                    {
                        name: '📊 Connection Quality',
                        value: connectionQuality,
                        inline: true
                    }
                )
                .setFooter({
                    text: 'Lower latency = better performance'
                })
                .setTimestamp();
            
            // Send the response
            const startTime = Date.now();
            const reply = await message.reply({ embeds: [pingEmbed] });
            
            // Calculate actual response time and edit the message
            const actualResponseTime = Date.now() - startTime;
            
            // Update the embed with actual response time
            pingEmbed.addFields({
                name: '⚡ Actual Response Time',
                value: `${actualResponseTime}ms`,
                inline: true
            });
            
            await reply.edit({ embeds: [pingEmbed] });
            
            // Log the ping command usage
            logger.debug(`Ping command executed`, {
                user: message.author.tag,
                botLatency: botLatency,
                apiLatency: apiLatency,
                responseTime: actualResponseTime
            });
            
        } catch (error) {
            logger.error('Error in ping command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Error')
                .setDescription('An error occurred while checking ping.')
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }
    }
};