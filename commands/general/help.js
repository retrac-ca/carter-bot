/**
 * Help Command
 * 
 * This command displays information about available commands.
 * It shows a general help message with all commands, or specific
 * information about a particular command when specified.
 * 
 * Usage: !help [command_name]
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
    name: 'help',
    description: 'Display help information about commands',
    usage: '[command_name]',
    aliases: ['h', 'commands'],
    category: 'general',
    cooldown: 5,
    
    /**
     * Execute the command
     * @param {Message} message - Discord message object
     * @param {Array} args - Command arguments
     * @param {Client} client - Discord client instance
     */
    async execute(message, args, client) {
        try {
            const prefix = process.env.PREFIX || '!';
            
            // If a specific command is requested
            if (args.length > 0) {
                const commandName = args[0].toLowerCase();
                const command = client.commands.get(commandName) || 
                               client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
                
                if (!command) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Command Not Found')
                        .setDescription(`No command named \`${commandName}\` was found.`)
                        .addFields({
                            name: '💡 Tip',
                            value: `Use \`${prefix}help\` to see all available commands.`
                        })
                        .setTimestamp();
                    
                    return message.reply({ embeds: [errorEmbed] });
                }
                
                // Show detailed information about specific command
                const commandEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`📖 Command: ${prefix}${command.name}`)
                    .setDescription(command.description || 'No description available.')
                    .setTimestamp();
                
                // Add usage information
                if (command.usage) {
                    commandEmbed.addFields({
                        name: '📝 Usage',
                        value: `\`${prefix}${command.name} ${command.usage}\``,
                        inline: false
                    });
                }
                
                // Add aliases
                if (command.aliases && command.aliases.length > 0) {
                    commandEmbed.addFields({
                        name: '🔗 Aliases',
                        value: command.aliases.map(alias => `\`${prefix}${alias}\``).join(', '),
                        inline: true
                    });
                }
                
                // Add cooldown
                if (command.cooldown) {
                    commandEmbed.addFields({
                        name: '⏰ Cooldown',
                        value: `${command.cooldown} seconds`,
                        inline: true
                    });
                }
                
                // Add permissions required
                if (command.permissions && command.permissions.length > 0) {
                    commandEmbed.addFields({
                        name: '🔐 Permissions Required',
                        value: command.permissions.join(', '),
                        inline: false
                    });
                }
                
                // Add guild only notice
                if (command.guildOnly) {
                    commandEmbed.addFields({
                        name: '🏠 Server Only',
                        value: 'This command can only be used in servers, not in DMs.',
                        inline: false
                    });
                }
                
                return message.reply({ embeds: [commandEmbed] });
            }
            
            // Show general help with all commands
            const helpEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🤖 CarterBot Help')
                .setDescription('Here are all the available commands organized by category.')
                .setThumbnail(client.user.displayAvatarURL())
                .setTimestamp();
            
            // Group commands by category
            const categories = {};
            
            client.commands.forEach(command => {
                const category = command.category || 'general';
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push(command);
            });
            
            // Add each category as a field
            const categoryEmojis = {
                'rss': '📰',
                'general': '⚙️',
                'moderation': '🛡️',
                'utility': '🔧'
            };
            
            for (const [categoryName, commands] of Object.entries(categories)) {
                const emoji = categoryEmojis[categoryName] || '📁';
                const commandList = commands
                    .map(cmd => `\`${prefix}${cmd.name}\` - ${cmd.description || 'No description'}`)
                    .join('\n');
                
                helpEmbed.addFields({
                    name: `${emoji} ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} Commands`,
                    value: commandList || 'No commands in this category.',
                    inline: false
                });
            }
            
            // Add footer with additional information
            helpEmbed.setFooter({
                text: `Use ${prefix}help <command> for detailed information about a specific command.`
            });
            
            // Add bot information
            helpEmbed.addFields({
                name: '🔗 Additional Information',
                value: [
                    `**Prefix:** \`${prefix}\``,
                    `**Total Commands:** ${client.commands.size}`,
                    `**Servers:** ${client.guilds.cache.size}`,
                    '**Support:** Check the README.md file for more information'
                ].join('\n'),
                inline: false
            });
            
            return message.reply({ embeds: [helpEmbed] });
            
        } catch (error) {
            logger.error('Error in help command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Error')
                .setDescription('An error occurred while generating help information.')
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }
    }
};