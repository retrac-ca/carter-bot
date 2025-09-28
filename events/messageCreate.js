/**
 * Message Create Event Handler
 * 
 * This event is triggered whenever a message is sent in a channel
 * that the bot can see. This is where we handle command processing,
 * cooldowns, and other message-related functionality.
 */

const { Collection } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: 'messageCreate',
    
    /**
     * Execute function called when a message is created
     * @param {Message} message - Discord message object
     * @param {Client} client - Discord client instance
     */
    async execute(message, client) {
        // Ignore messages from bots (including ourselves)
        if (message.author.bot) return;
        
        // Get the prefix from environment or default to '!'
        const prefix = process.env.PREFIX || '!';
        
        // Ignore messages that don't start with our prefix
        if (!message.content.startsWith(prefix)) return;
        
        // Parse the command and arguments
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        // Try to find the command
        const command = client.commands.get(commandName) || 
                       client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        
        // If no command is found, ignore silently
        if (!command) return;
        
        try {
            // Log command usage
            logger.logCommand(message, commandName, 'attempted');
            
            // Check if command can only be used in guilds
            if (command.guildOnly && !message.guild) {
                return message.reply('❌ This command can only be used in servers, not in DMs.');
            }
            
            // Check if user has required permissions
            if (command.permissions) {
                if (!message.guild) {
                    return message.reply('❌ This command requires server permissions.');
                }
                
                const authorPerms = message.member.permissions;
                const missingPerms = command.permissions.filter(perm => !authorPerms.has(perm));
                
                if (missingPerms.length > 0) {
                    return message.reply(`❌ You need the following permissions: ${missingPerms.join(', ')}`);
                }
            }
            
            // Check if command requires arguments
            if (command.args && !args.length) {
                let reply = `❌ You didn't provide any arguments!`;
                
                if (command.usage) {
                    reply += `\nUsage: \`${prefix}${command.name} ${command.usage}\``;
                }
                
                return message.reply(reply);
            }
            
            // Handle command cooldowns
            if (!client.cooldowns.has(command.name)) {
                client.cooldowns.set(command.name, new Collection());
            }
            
            const now = Date.now();
            const timestamps = client.cooldowns.get(command.name);
            const cooldownAmount = (command.cooldown || 3) * 1000; // Default 3 second cooldown
            
            if (timestamps.has(message.author.id)) {
                const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
                
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return message.reply(`⏰ Please wait ${timeLeft.toFixed(1)} more seconds before using \`${command.name}\` again.`);
                }
            }
            
            // Set cooldown timestamp
            timestamps.set(message.author.id, now);
            setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
            
            // Execute the command
            const startTime = Date.now();
            
            await command.execute(message, args, client);
            
            // Log successful execution with performance metrics
            const executionTime = Date.now() - startTime;
            logger.logCommand(message, commandName, 'completed');
            logger.logPerformance(`Command ${commandName}`, executionTime, {
                args: args.length,
                guild: message.guild?.name || 'DM',
                user: message.author.tag
            });
            
        } catch (error) {
            // Log the error with context
            logger.error('Command execution error:', {
                command: commandName,
                user: message.author.tag,
                guild: message.guild?.name || 'DM',
                channel: message.channel.name || 'DM',
                args: args,
                error: error.message,
                stack: error.stack
            });
            
            // Send error message to user
            try {
                await message.reply('❌ An error occurred while executing this command. Please try again later.');
            } catch (replyError) {
                logger.error('Failed to send error reply:', replyError);
            }
            
            // Log command as failed
            logger.logCommand(message, commandName, 'failed');
        }
    }
};