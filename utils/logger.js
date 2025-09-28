/**
 * Logger Utility
 * 
 * This module provides logging functionality for the CarterBot.
 * It supports different log levels and can output to both console and files.
 * 
 * Log Levels:
 * - error: Error messages that need immediate attention
 * - warn: Warning messages for potential issues
 * - info: General information messages
 * - debug: Detailed debug information for development
 */

const fs = require('fs-extra');
const path = require('path');

class Logger {
    constructor() {
        // Ensure logs directory exists
        this.logsDir = path.join(__dirname, '..', 'logs');
        this.logFile = path.join(this.logsDir, 'bot.log');
        
        // Log levels with numeric values for comparison
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        // Current log level from environment or default to 'info'
        this.currentLevel = process.env.LOG_LEVEL || 'info';
        
        // Initialize logging
        this.init();
    }

    /**
     * Initialize the logger
     * Creates logs directory and sets up log rotation if needed
     */
    async init() {
        try {
            // Ensure logs directory exists
            await fs.ensureDir(this.logsDir);
            
            // Rotate log file if it's too large (> 10MB)
            await this.rotateLogIfNeeded();
            
        } catch (error) {
            console.error('Failed to initialize logger:', error);
        }
    }

    /**
     * Rotate log file if it exceeds size limit
     */
    async rotateLogIfNeeded() {
        try {
            const maxSize = 10 * 1024 * 1024; // 10MB
            
            if (await fs.pathExists(this.logFile)) {
                const stats = await fs.stat(this.logFile);
                
                if (stats.size > maxSize) {
                    const backupFile = path.join(this.logsDir, `bot.log.${Date.now()}`);
                    await fs.move(this.logFile, backupFile);
                    console.log(`Log file rotated to: ${backupFile}`);
                }
            }
        } catch (error) {
            console.error('Error rotating log file:', error);
        }
    }

    /**
     * Check if a message should be logged based on current log level
     * @param {string} level - Log level to check
     * @returns {boolean} True if message should be logged
     */
    shouldLog(level) {
        return this.levels[level] <= this.levels[this.currentLevel];
    }

    /**
     * Format a log message with timestamp and level
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     * @returns {string} Formatted log message
     */
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const levelUpper = level.toUpperCase().padEnd(5);
        
        // Convert additional arguments to strings
        const argsString = args.length > 0 ? ' ' + args.map(arg => {
            if (typeof arg === 'object') {
                return JSON.stringify(arg, null, 2);
            }
            return String(arg);
        }).join(' ') : '';
        
        return `[${timestamp}] ${levelUpper}: ${message}${argsString}`;
    }

    /**
     * Get console color for log level
     * @param {string} level - Log level
     * @returns {string} ANSI color code
     */
    getColor(level) {
        const colors = {
            error: '\x1b[31m',   // Red
            warn: '\x1b[33m',    // Yellow
            info: '\x1b[36m',    // Cyan
            debug: '\x1b[90m'    // Gray
        };
        
        return colors[level] || '\x1b[0m';
    }

    /**
     * Write log message to file
     * @param {string} formattedMessage - Formatted log message
     */
    async writeToFile(formattedMessage) {
        try {
            await fs.appendFile(this.logFile, formattedMessage + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    /**
     * Log a message with specified level
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    async log(level, message, ...args) {
        if (!this.shouldLog(level)) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, ...args);
        
        // Output to console with colors
        const color = this.getColor(level);
        const resetColor = '\x1b[0m';
        console.log(`${color}${formattedMessage}${resetColor}`);
        
        // Write to log file (without colors)
        await this.writeToFile(formattedMessage);
    }

    /**
     * Log an error message
     * @param {string} message - Error message
     * @param {...any} args - Additional arguments
     */
    error(message, ...args) {
        return this.log('error', message, ...args);
    }

    /**
     * Log a warning message
     * @param {string} message - Warning message
     * @param {...any} args - Additional arguments
     */
    warn(message, ...args) {
        return this.log('warn', message, ...args);
    }

    /**
     * Log an info message
     * @param {string} message - Info message
     * @param {...any} args - Additional arguments
     */
    info(message, ...args) {
        return this.log('info', message, ...args);
    }

    /**
     * Log a debug message
     * @param {string} message - Debug message
     * @param {...any} args - Additional arguments
     */
    debug(message, ...args) {
        return this.log('debug', message, ...args);
    }

    /**
     * Log command usage
     * @param {Object} message - Discord message object
     * @param {string} commandName - Name of the command
     * @param {string} status - Command status (success, error, etc.)
     */
    logCommand(message, commandName, status = 'executed') {
        const userId = message.author?.id || 'unknown';
        const username = message.author?.tag || 'unknown';
        const guildId = message.guild?.id || 'DM';
        const channelId = message.channel?.id || 'unknown';
        
        this.info(`Command ${commandName} ${status}`, {
            user: `${username} (${userId})`,
            guild: guildId,
            channel: channelId
        });
    }

    /**
     * Log RSS feed activity
     * @param {string} action - Action performed (added, removed, checked, etc.)
     * @param {string} feedUrl - RSS feed URL
     * @param {string} channelId - Discord channel ID
     * @param {string} details - Additional details
     */
    logRSS(action, feedUrl, channelId, details = '') {
        this.info(`RSS ${action}: ${feedUrl}`, {
            channel: channelId,
            details: details
        });
    }

    /**
     * Log performance metrics
     * @param {string} operation - Operation name
     * @param {number} duration - Duration in milliseconds
     * @param {Object} metadata - Additional metadata
     */
    logPerformance(operation, duration, metadata = {}) {
        this.debug(`Performance: ${operation} took ${duration}ms`, metadata);
    }

    /**
     * Log Discord API rate limit information
     * @param {string} endpoint - API endpoint
     * @param {number} remaining - Remaining requests
     * @param {number} resetTime - Reset time
     */
    logRateLimit(endpoint, remaining, resetTime) {
        if (remaining < 5) {
            this.warn(`Rate limit warning for ${endpoint}`, {
                remaining: remaining,
                resetTime: new Date(resetTime).toISOString()
            });
        } else {
            this.debug(`Rate limit info for ${endpoint}`, {
                remaining: remaining,
                resetTime: new Date(resetTime).toISOString()
            });
        }
    }

    /**
     * Set the current log level
     * @param {string} level - New log level
     */
    setLevel(level) {
        if (this.levels[level] !== undefined) {
            this.currentLevel = level;
            this.info(`Log level set to: ${level}`);
        } else {
            this.error(`Invalid log level: ${level}`);
        }
    }

    /**
     * Get current log level
     * @returns {string} Current log level
     */
    getLevel() {
        return this.currentLevel;
    }

    /**
     * Clean up old log files
     * @param {number} maxAge - Maximum age in days
     */
    async cleanupLogs(maxAge = 7) {
        try {
            const files = await fs.readdir(this.logsDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAge);

            for (const file of files) {
                if (file.startsWith('bot.log.')) {
                    const filePath = path.join(this.logsDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        await fs.remove(filePath);
                        this.info(`Cleaned up old log file: ${file}`);
                    }
                }
            }
        } catch (error) {
            this.error('Error cleaning up log files:', error);
        }
    }
}

// Export singleton instance
module.exports = new Logger();