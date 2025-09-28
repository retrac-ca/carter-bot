/**
 * RSS Manager Utility
 * 
 * This module handles all RSS feed-related operations including:
 * - Adding and removing RSS feeds
 * - Checking feeds for updates
 * - Managing feed intervals and scheduling
 * - Posting new items to Discord channels
 * 
 * The RSS Manager stores feed data in JSON files and uses node-cron
 * for scheduling feed checks at regular intervals.
 */

const Parser = require('rss-parser');
const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');

const logger = require('./logger');

class RSSManager {
    constructor() {
        // Initialize RSS parser with custom fields
        this.parser = new Parser({
            customFields: {
                item: [
                    ['media:content', 'mediaContent'],
                    ['media:thumbnail', 'mediaThumbnail'],
                    ['description', 'description'],
                    ['content:encoded', 'contentEncoded']
                ]
            }
        });
        
        // Path to store feed data
        this.dataPath = path.join(__dirname, '..', 'data');
        this.feedsFile = path.join(this.dataPath, 'feeds.json');
        this.configFile = path.join(this.dataPath, 'config.json');
        
        // In-memory storage for feeds and configuration
        this.feeds = new Map();
        this.config = {
            defaultInterval: 300000, // 5 minutes in milliseconds
            maxFeedsPerChannel: 10,
            enableWebDashboard: true,
            logLevel: 'info'
        };
        
        // Store active cron jobs for each feed
        this.cronJobs = new Map();
        
        // Client reference for sending messages
        this.client = null;
    }

    /**
     * Initialize the RSS Manager
     * Creates data directory and loads existing feeds and configuration
     */
    async initialize() {
        try {
            logger.info('Initializing RSS Manager...');
            
            // Ensure data directory exists
            await fs.ensureDir(this.dataPath);
            
            // Load existing feeds and configuration
            await this.loadFeeds();
            await this.loadConfig();
            
            logger.info(`RSS Manager initialized with ${this.feeds.size} feeds`);
            
        } catch (error) {
            logger.error('Failed to initialize RSS Manager:', error);
            throw error;
        }
    }

    /**
     * Load feeds from JSON file
     */
    async loadFeeds() {
        try {
            if (await fs.pathExists(this.feedsFile)) {
                const feedData = await fs.readJson(this.feedsFile);
                
                // Convert object structure to Map
                for (const [channelId, channelFeeds] of Object.entries(feedData)) {
                    if (!this.feeds.has(channelId)) {
                        this.feeds.set(channelId, new Map());
                    }
                    
                    const channelFeedMap = this.feeds.get(channelId);
                    for (const [feedUrl, feedInfo] of Object.entries(channelFeeds)) {
                        channelFeedMap.set(feedUrl, {
                            url: feedInfo.url,
                            interval: feedInfo.interval || this.config.defaultInterval,
                            lastChecked: feedInfo.lastChecked ? new Date(feedInfo.lastChecked) : null,
                            lastPostId: feedInfo.lastPostId || null,
                            active: feedInfo.active !== false, // Default to true
                            title: feedInfo.title || 'Unknown Feed',
                            description: feedInfo.description || ''
                        });
                    }
                }
                
                logger.info(`Loaded ${this.feeds.size} channel feed configurations`);
            } else {
                logger.info('No existing feeds file found, starting fresh');
            }
        } catch (error) {
            logger.error('Error loading feeds:', error);
            // Continue with empty feeds if loading fails
            this.feeds = new Map();
        }
    }

    /**
     * Save feeds to JSON file
     */
    async saveFeeds() {
        try {
            const feedData = {};
            
            // Convert Map structure back to object for JSON storage
            for (const [channelId, channelFeeds] of this.feeds.entries()) {
                feedData[channelId] = {};
                
                for (const [feedUrl, feedInfo] of channelFeeds.entries()) {
                    feedData[channelId][feedUrl] = {
                        url: feedInfo.url,
                        interval: feedInfo.interval,
                        lastChecked: feedInfo.lastChecked ? feedInfo.lastChecked.toISOString() : null,
                        lastPostId: feedInfo.lastPostId,
                        active: feedInfo.active,
                        title: feedInfo.title,
                        description: feedInfo.description
                    };
                }
            }
            
            await fs.writeJson(this.feedsFile, feedData, { spaces: 2 });
            logger.debug('Feeds saved to file');
            
        } catch (error) {
            logger.error('Error saving feeds:', error);
            throw error;
        }
    }

    /**
     * Load configuration from JSON file
     */
    async loadConfig() {
        try {
            if (await fs.pathExists(this.configFile)) {
                const configData = await fs.readJson(this.configFile);
                this.config = { ...this.config, ...configData };
                logger.info('Configuration loaded');
            } else {
                // Save default configuration
                await this.saveConfig();
                logger.info('Default configuration created');
            }
        } catch (error) {
            logger.error('Error loading configuration:', error);
        }
    }

    /**
     * Save configuration to JSON file
     */
    async saveConfig() {
        try {
            await fs.writeJson(this.configFile, this.config, { spaces: 2 });
            logger.debug('Configuration saved');
        } catch (error) {
            logger.error('Error saving configuration:', error);
        }
    }

    /**
     * Add a new RSS feed to a channel
     * @param {string} channelId - Discord channel ID
     * @param {string} feedUrl - RSS feed URL
     * @param {number} interval - Check interval in milliseconds (optional)
     * @returns {Object} Result object with success status and message
     */
    async addFeed(channelId, feedUrl, interval = null) {
        try {
            // Validate the RSS feed URL
            const feedInfo = await this.validateFeed(feedUrl);
            if (!feedInfo.valid) {
                return {
                    success: false,
                    message: `Invalid RSS feed: ${feedInfo.error}`
                };
            }

            // Check if channel already has maximum number of feeds
            if (!this.feeds.has(channelId)) {
                this.feeds.set(channelId, new Map());
            }
            
            const channelFeeds = this.feeds.get(channelId);
            if (channelFeeds.size >= this.config.maxFeedsPerChannel) {
                return {
                    success: false,
                    message: `Maximum number of feeds (${this.config.maxFeedsPerChannel}) reached for this channel`
                };
            }

            // Check if feed already exists in this channel
            if (channelFeeds.has(feedUrl)) {
                return {
                    success: false,
                    message: 'This RSS feed is already added to this channel'
                };
            }

            // Add the feed
            const feedData = {
                url: feedUrl,
                interval: interval || this.config.defaultInterval,
                lastChecked: null,
                lastPostId: null,
                active: true,
                title: feedInfo.feed.title || 'Unknown Feed',
                description: feedInfo.feed.description || ''
            };

            channelFeeds.set(feedUrl, feedData);
            
            // Save to file
            await this.saveFeeds();
            
            // Start checking this feed
            this.startFeedCheck(channelId, feedUrl);
            
            logger.info(`Added RSS feed "${feedData.title}" to channel ${channelId}`);
            
            return {
                success: true,
                message: `Successfully added RSS feed: ${feedData.title}`,
                feedInfo: feedData
            };
            
        } catch (error) {
            logger.error('Error adding feed:', error);
            return {
                success: false,
                message: 'An error occurred while adding the feed'
            };
        }
    }

    /**
     * Remove an RSS feed from a channel
     * @param {string} channelId - Discord channel ID
     * @param {string} feedUrl - RSS feed URL to remove
     * @returns {Object} Result object with success status and message
     */
    async removeFeed(channelId, feedUrl) {
        try {
            if (!this.feeds.has(channelId)) {
                return {
                    success: false,
                    message: 'No RSS feeds found for this channel'
                };
            }

            const channelFeeds = this.feeds.get(channelId);
            if (!channelFeeds.has(feedUrl)) {
                return {
                    success: false,
                    message: 'RSS feed not found in this channel'
                };
            }

            const feedInfo = channelFeeds.get(feedUrl);
            channelFeeds.delete(feedUrl);
            
            // Remove empty channel entry
            if (channelFeeds.size === 0) {
                this.feeds.delete(channelId);
            }
            
            // Stop checking this feed
            this.stopFeedCheck(channelId, feedUrl);
            
            // Save to file
            await this.saveFeeds();
            
            logger.info(`Removed RSS feed "${feedInfo.title}" from channel ${channelId}`);
            
            return {
                success: true,
                message: `Successfully removed RSS feed: ${feedInfo.title}`
            };
            
        } catch (error) {
            logger.error('Error removing feed:', error);
            return {
                success: false,
                message: 'An error occurred while removing the feed'
            };
        }
    }

    /**
     * Get all RSS feeds for a channel
     * @param {string} channelId - Discord channel ID
     * @returns {Array} Array of feed information objects
     */
    getChannelFeeds(channelId) {
        if (!this.feeds.has(channelId)) {
            return [];
        }

        const channelFeeds = this.feeds.get(channelId);
        const feedList = [];
        
        for (const [url, feedInfo] of channelFeeds.entries()) {
            feedList.push({
                url: url,
                title: feedInfo.title,
                description: feedInfo.description,
                active: feedInfo.active,
                lastChecked: feedInfo.lastChecked,
                interval: feedInfo.interval
            });
        }
        
        return feedList;
    }

    /**
     * Validate an RSS feed URL
     * @param {string} feedUrl - RSS feed URL to validate
     * @returns {Object} Validation result with feed data if valid
     */
    async validateFeed(feedUrl) {
        try {
            const feed = await this.parser.parseURL(feedUrl);
            return {
                valid: true,
                feed: feed
            };
        } catch (error) {
            logger.warn(`Failed to validate RSS feed ${feedUrl}:`, error.message);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Check a specific RSS feed for new items
     * @param {string} channelId - Discord channel ID
     * @param {string} feedUrl - RSS feed URL
     */
    async checkFeed(channelId, feedUrl) {
        try {
            if (!this.client) {
                logger.warn('Discord client not set, skipping feed check');
                return;
            }

            const channelFeeds = this.feeds.get(channelId);
            if (!channelFeeds || !channelFeeds.has(feedUrl)) {
                return;
            }

            const feedInfo = channelFeeds.get(feedUrl);
            if (!feedInfo.active) {
                return;
            }

            logger.debug(`Checking RSS feed: ${feedInfo.title}`);

            // Parse the RSS feed
            const feed = await this.parser.parseURL(feedUrl);
            
            // Update feed title and description if they've changed
            if (feed.title !== feedInfo.title) {
                feedInfo.title = feed.title;
            }
            if (feed.description !== feedInfo.description) {
                feedInfo.description = feed.description;
            }

            // Check for new items
            if (feed.items && feed.items.length > 0) {
                const latestItem = feed.items[0];
                
                // If this is the first check or there's a new item
                if (!feedInfo.lastPostId || feedInfo.lastPostId !== latestItem.guid) {
                    // Post new items (up to 5 to avoid spam)
                    const newItems = [];
                    
                    for (const item of feed.items) {
                        if (feedInfo.lastPostId && item.guid === feedInfo.lastPostId) {
                            break;
                        }
                        newItems.push(item);
                        
                        // Limit to 5 new posts to avoid spam
                        if (newItems.length >= 5) {
                            break;
                        }
                    }
                    
                    // Post items in reverse order (oldest first)
                    newItems.reverse();
                    
                    for (const item of newItems) {
                        await this.postFeedItem(channelId, feed, item);
                        
                        // Small delay between posts to avoid rate limits
                        if (newItems.length > 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                    
                    // Update last post ID
                    feedInfo.lastPostId = latestItem.guid;
                }
            }

            // Update last checked time
            feedInfo.lastChecked = new Date();
            
            // Save changes
            await this.saveFeeds();
            
        } catch (error) {
            logger.error(`Error checking RSS feed ${feedUrl}:`, error);
            
            // If the feed consistently fails, consider marking it as inactive
            const feedInfo = this.feeds.get(channelId)?.get(feedUrl);
            if (feedInfo) {
                // You could implement a failure counter here and disable after X failures
                logger.warn(`RSS feed ${feedInfo.title} failed to update`);
            }
        }
    }

    /**
     * Post a feed item to Discord channel
     * @param {string} channelId - Discord channel ID
     * @param {Object} feed - RSS feed object
     * @param {Object} item - RSS feed item
     */
    async postFeedItem(channelId, feed, item) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                logger.error(`Channel ${channelId} not found`);
                return;
            }

            // Create embed for the RSS item
            const embed = new EmbedBuilder()
                .setTitle(item.title || 'No Title')
                .setURL(item.link || null)
                .setDescription(this.truncateDescription(item.contentSnippet || item.description || 'No description available'))
                .setColor(0x0099FF)
                .setTimestamp(item.pubDate ? new Date(item.pubDate) : new Date())
                .setFooter({
                    text: feed.title || 'RSS Feed',
                    iconURL: feed.image?.url || null
                });

            // Add author if available
            if (item.creator || item.author) {
                embed.setAuthor({
                    name: item.creator || item.author
                });
            }

            // Add thumbnail if available
            if (item.mediaThumbnail?.url || item.mediaContent?.url) {
                const thumbnailUrl = item.mediaThumbnail?.url || item.mediaContent?.url;
                embed.setThumbnail(thumbnailUrl);
            }

            // Send the embed
            await channel.send({ embeds: [embed] });
            
            logger.info(`Posted RSS item "${item.title}" to channel ${channelId}`);
            
        } catch (error) {
            logger.error(`Error posting RSS item to channel ${channelId}:`, error);
        }
    }

    /**
     * Truncate description text to fit Discord embed limits
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length (default 2048 for Discord embeds)
     * @returns {string} Truncated text
     */
    truncateDescription(text, maxLength = 2048) {
        if (!text) return 'No description available';
        
        if (text.length <= maxLength) {
            return text;
        }
        
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Start checking all feeds at their scheduled intervals
     * @param {Client} client - Discord client instance
     */
    startFeedChecking(client) {
        this.client = client;
        
        logger.info('Starting RSS feed checking...');
        
        // Start checking each feed
        for (const [channelId, channelFeeds] of this.feeds.entries()) {
            for (const [feedUrl] of channelFeeds.entries()) {
                this.startFeedCheck(channelId, feedUrl);
            }
        }
        
        logger.info(`Started monitoring ${this.getTotalFeedCount()} RSS feeds`);
    }

    /**
     * Start checking a specific feed
     * @param {string} channelId - Discord channel ID
     * @param {string} feedUrl - RSS feed URL
     */
    startFeedCheck(channelId, feedUrl) {
        const feedKey = `${channelId}-${feedUrl}`;
        
        // Stop existing job if it exists
        this.stopFeedCheck(channelId, feedUrl);
        
        const feedInfo = this.feeds.get(channelId)?.get(feedUrl);
        if (!feedInfo || !feedInfo.active) {
            return;
        }

        // Convert interval from milliseconds to minutes for cron
        const intervalMinutes = Math.max(1, Math.floor(feedInfo.interval / 60000));
        const cronExpression = `*/${intervalMinutes} * * * *`;
        
        try {
            const job = cron.schedule(cronExpression, () => {
                this.checkFeed(channelId, feedUrl);
            }, {
                scheduled: false
            });
            
            this.cronJobs.set(feedKey, job);
            job.start();
            
            logger.debug(`Started monitoring RSS feed "${feedInfo.title}" (every ${intervalMinutes} minutes)`);
            
        } catch (error) {
            logger.error(`Error starting feed check for ${feedUrl}:`, error);
        }
    }

    /**
     * Stop checking a specific feed
     * @param {string} channelId - Discord channel ID
     * @param {string} feedUrl - RSS feed URL
     */
    stopFeedCheck(channelId, feedUrl) {
        const feedKey = `${channelId}-${feedUrl}`;
        
        if (this.cronJobs.has(feedKey)) {
            const job = this.cronJobs.get(feedKey);
            job.stop();
            job.destroy();
            this.cronJobs.delete(feedKey);
            
            logger.debug(`Stopped monitoring RSS feed: ${feedUrl}`);
        }
    }

    /**
     * Stop all feed checking
     */
    stopFeedChecking() {
        logger.info('Stopping RSS feed checking...');
        
        for (const [feedKey, job] of this.cronJobs.entries()) {
            job.stop();
            job.destroy();
        }
        
        this.cronJobs.clear();
        logger.info('All RSS feed monitoring stopped');
    }

    /**
     * Get total number of feeds across all channels
     * @returns {number} Total feed count
     */
    getTotalFeedCount() {
        let count = 0;
        for (const channelFeeds of this.feeds.values()) {
            count += channelFeeds.size;
        }
        return count;
    }

    /**
     * Get RSS manager statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const stats = {
            totalFeeds: this.getTotalFeedCount(),
            totalChannels: this.feeds.size,
            activeJobs: this.cronJobs.size,
            config: { ...this.config }
        };
        
        return stats;
    }
}

// Export singleton instance
module.exports = new RSSManager();