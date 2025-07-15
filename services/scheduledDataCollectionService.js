const cron = require('node-cron');
const logger = require('../logger');
const VisualPropertyScrapingService = require('./visualPropertyScrapingService');
const ExternalScrapingService = require('./externalScrapingService');
const VisualAnalysisService = require('./visualAnalysisService');
const databaseService = require('./databaseService');

class ScheduledDataCollectionService {
  constructor() {
    this.scrapingService = new VisualPropertyScrapingService();
    this.externalScrapingService = new ExternalScrapingService();
    this.analysisService = new VisualAnalysisService();
    this.isRunning = false;
    this.scheduledTasks = new Map();
  }

  /**
   * Initialize all scheduled tasks
   */
  initialize() {
    logger.info('Initializing scheduled data collection service');

    // Daily full scraping at 2 AM Singapore time
    this.scheduleTask('daily-scraping', '0 2 * * *', async () => {
      await this.runFullScraping();
    });

    // Process AI analysis every 4 hours
    this.scheduleTask('ai-analysis', '0 */4 * * *', async () => {
      await this.runAIAnalysis();
    });

    // Weekly cleanup of old sessions (Sundays at 3 AM)
    this.scheduleTask('weekly-cleanup', '0 3 * * 0', async () => {
      await this.cleanupOldSessions();
    });

    // Hourly health check and retry failed operations
    this.scheduleTask('hourly-maintenance', '0 * * * *', async () => {
      await this.runMaintenance();
    });

    logger.info({
      scheduledTasks: Array.from(this.scheduledTasks.keys())
    }, 'Scheduled tasks initialized');
  }

  /**
   * Schedule a task with cron expression
   */
  scheduleTask(taskName, cronExpression, taskFunction) {
    try {
      const task = cron.schedule(cronExpression, async () => {
        if (this.isRunning) {
          logger.warn({ taskName }, 'Skipping task - another operation is running');
          return;
        }

        try {
          this.isRunning = true;
          logger.info({ taskName }, 'Starting scheduled task');
          
          const startTime = Date.now();
          await taskFunction();
          const duration = Date.now() - startTime;
          
          logger.info({
            taskName,
            duration: `${duration}ms`
          }, 'Scheduled task completed');

        } catch (error) {
          logger.error({
            err: error,
            taskName
          }, 'Scheduled task failed');
        } finally {
          this.isRunning = false;
        }
      }, {
        scheduled: false,
        timezone: 'Asia/Singapore'
      });

      this.scheduledTasks.set(taskName, task);
      logger.info({ taskName, cronExpression }, 'Task scheduled');

    } catch (error) {
      logger.error({
        err: error,
        taskName,
        cronExpression
      }, 'Failed to schedule task');
    }
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    logger.info('Starting scheduled data collection service');
    
    for (const [taskName, task] of this.scheduledTasks) {
      try {
        task.start();
        logger.info({ taskName }, 'Task started');
      } catch (error) {
        logger.error({ err: error, taskName }, 'Failed to start task');
      }
    }

    logger.info('All scheduled tasks started');
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    logger.info('Stopping scheduled data collection service');
    
    for (const [taskName, task] of this.scheduledTasks) {
      try {
        task.stop();
        logger.info({ taskName }, 'Task stopped');
      } catch (error) {
        logger.error({ err: error, taskName }, 'Failed to stop task');
      }
    }

    this.isRunning = false;
    logger.info('All scheduled tasks stopped');
  }

  /**
   * Run full property data scraping
   */
  async runFullScraping() {
    try {
      logger.info('Starting scheduled full scraping');

      // Check if there's a recent successful scraping session
      const { data: recentSession } = await supabase
        .from('scraping_sessions')
        .select('*')
        .eq('status', 'completed')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (recentSession) {
        logger.info({
          sessionId: recentSession.id,
          completedAt: recentSession.completed_at
        }, 'Recent scraping session found, skipping full scrape');
        return;
      }

      // Try external scraping service first (Railway-compatible)
      let result;
      try {
        logger.info('Attempting external scraping service');
        result = await this.externalScrapingService.scrapePropertyData();
      } catch (externalError) {
        logger.warn({ err: externalError }, 'External scraping failed, trying fallback method');

        // Fallback to original scraping service (may fail on Railway)
        try {
          result = await this.scrapingService.scrapePropertyData();
        } catch (fallbackError) {
          logger.error({ err: fallbackError }, 'All scraping methods failed');
          throw new Error('All scraping methods failed');
        }
      }

      logger.info({
        processed: result.processed,
        updated: result.updated,
        assets: result.assetsDownloaded || 0,
        errors: result.errors,
        provider: result.provider || 'unknown'
      }, 'Scheduled scraping completed');

      // Trigger AI analysis for new assets
      if (result.updated > 0) {
        logger.info('Triggering AI analysis for new assets');
        setTimeout(() => this.runAIAnalysis(), 5000); // Wait 5 seconds then analyze
      }

    } catch (error) {
      logger.error({ err: error }, 'Scheduled scraping failed');

      // Log the failure for monitoring
      await this.logScheduledTaskFailure('full-scraping', error.message);
    }
  }

  /**
   * Run AI analysis on pending assets
   */
  async runAIAnalysis() {
    try {
      logger.info('Starting scheduled AI analysis');

      const result = await this.analysisService.processAllPendingAssets();
      
      logger.info({
        processed: result.processed,
        errors: result.errors
      }, 'Scheduled AI analysis completed');

      // Update search index after analysis
      if (result.processed > 0) {
        await this.updateSearchIndex();
      }

    } catch (error) {
      logger.error({ err: error }, 'Scheduled AI analysis failed');
      await this.logScheduledTaskFailure('ai-analysis', error.message);
    }
  }

  /**
   * Update property search index
   */
  async updateSearchIndex() {
    try {
      logger.info('Updating property search index');

      // Get projects that need search index updates
      const { data: projects, error } = await supabase
        .from('property_projects')
        .select(`
          id, project_name, developer, address, district, property_type,
          visual_assets!inner(
            ai_visual_analysis(extracted_data, key_features, description)
          )
        `)
        .eq('scraping_status', 'completed');

      if (error) {
        throw new Error(`Failed to fetch projects: ${error.message}`);
      }

      for (const project of projects) {
        try {
          // Extract searchable content from AI analysis
          const searchableContent = this.extractSearchableContent(project);
          
          // Upsert search index
          await supabase
            .from('property_search_index')
            .upsert({
              project_id: project.id,
              keywords: searchableContent.keywords,
              amenities: searchableContent.amenities,
              family_friendly_score: searchableContent.familyScore,
              investment_potential_score: searchableContent.investmentScore,
              luxury_score: searchableContent.luxuryScore,
              last_indexed: new Date().toISOString()
            }, {
              onConflict: 'project_id'
            });

        } catch (projectError) {
          logger.error({
            err: projectError,
            projectId: project.id
          }, 'Failed to update search index for project');
        }
      }

      logger.info({ projectsProcessed: projects.length }, 'Search index update completed');

    } catch (error) {
      logger.error({ err: error }, 'Failed to update search index');
    }
  }

  /**
   * Extract searchable content from project data
   */
  extractSearchableContent(project) {
    const content = {
      keywords: [],
      amenities: [],
      familyScore: 0.5,
      investmentScore: 0.5,
      luxuryScore: 0.5
    };

    try {
      // Extract keywords from project basic info
      content.keywords.push(
        project.project_name,
        project.developer,
        project.district,
        project.property_type
      );

      // Extract from AI analysis
      if (project.visual_assets) {
        project.visual_assets.forEach(asset => {
          if (asset.ai_visual_analysis) {
            asset.ai_visual_analysis.forEach(analysis => {
              if (analysis.key_features) {
                content.amenities.push(...analysis.key_features);
              }
              
              if (analysis.extracted_data) {
                const data = analysis.extracted_data;
                
                // Calculate family-friendly score
                if (data.bedrooms >= 3 || data.keyFeatures?.includes('playground')) {
                  content.familyScore += 0.3;
                }
                
                // Calculate investment potential
                if (data.keyFeatures?.includes('near MRT') || project.district.startsWith('D0')) {
                  content.investmentScore += 0.3;
                }
                
                // Calculate luxury score
                if (data.amenities?.includes('swimming pool') || data.amenities?.includes('gym')) {
                  content.luxuryScore += 0.2;
                }
              }
            });
          }
        });
      }

      // Normalize scores
      content.familyScore = Math.min(1.0, content.familyScore);
      content.investmentScore = Math.min(1.0, content.investmentScore);
      content.luxuryScore = Math.min(1.0, content.luxuryScore);

      // Remove duplicates and clean keywords
      content.keywords = [...new Set(content.keywords.filter(k => k && k.trim()))];
      content.amenities = [...new Set(content.amenities.filter(a => a && a.trim()))];

    } catch (error) {
      logger.error({ err: error }, 'Error extracting searchable content');
    }

    return content;
  }

  /**
   * Clean up old scraping sessions and logs
   */
  async cleanupOldSessions() {
    try {
      logger.info('Starting weekly cleanup');

      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      // Delete old scraping sessions
      const { error: sessionError } = await supabase
        .from('scraping_sessions')
        .delete()
        .lt('started_at', cutoffDate.toISOString());

      if (sessionError) {
        logger.error({ err: sessionError }, 'Failed to cleanup old sessions');
      } else {
        logger.info('Old scraping sessions cleaned up');
      }

      // Clean up failed visual assets (older than 7 days)
      const assetCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const { error: assetError } = await supabase
        .from('visual_assets')
        .delete()
        .eq('processing_status', 'failed')
        .lt('created_at', assetCutoff.toISOString());

      if (assetError) {
        logger.error({ err: assetError }, 'Failed to cleanup failed assets');
      } else {
        logger.info('Failed visual assets cleaned up');
      }

    } catch (error) {
      logger.error({ err: error }, 'Weekly cleanup failed');
    }
  }

  /**
   * Run maintenance tasks
   */
  async runMaintenance() {
    try {
      // Retry failed scraping operations
      const { data: failedSessions } = await supabase
        .from('scraping_sessions')
        .select('*')
        .eq('status', 'failed')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(5);

      if (failedSessions && failedSessions.length > 0) {
        logger.info({ count: failedSessions.length }, 'Found failed sessions to retry');
        
        // For now, just log them. In production, you might want to retry
        failedSessions.forEach(session => {
          logger.info({
            sessionId: session.id,
            failedAt: session.completed_at,
            errors: session.errors_encountered
          }, 'Failed session identified for potential retry');
        });
      }

      // Check for assets stuck in processing
      const { data: stuckAssets } = await supabase
        .from('visual_assets')
        .select('*')
        .eq('processing_status', 'processing')
        .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // 1 hour ago

      if (stuckAssets && stuckAssets.length > 0) {
        logger.warn({ count: stuckAssets.length }, 'Found assets stuck in processing');
        
        // Reset stuck assets to pending
        await supabase
          .from('visual_assets')
          .update({ processing_status: 'pending' })
          .in('id', stuckAssets.map(a => a.id));
      }

    } catch (error) {
      logger.error({ err: error }, 'Maintenance tasks failed');
    }
  }

  /**
   * Log scheduled task failure for monitoring
   */
  async logScheduledTaskFailure(taskName, errorMessage) {
    try {
      // You could extend this to send alerts, notifications, etc.
      logger.error({
        taskName,
        errorMessage,
        timestamp: new Date().toISOString()
      }, 'Scheduled task failure logged');

    } catch (error) {
      logger.error({ err: error }, 'Failed to log task failure');
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: Array.from(this.scheduledTasks.keys()),
      activeTasksCount: Array.from(this.scheduledTasks.values())
        .filter(task => task.running).length
    };
  }

  /**
   * Manually trigger a specific task
   */
  async triggerTask(taskName) {
    const taskMap = {
      'scraping': () => this.runFullScraping(),
      'analysis': () => this.runAIAnalysis(),
      'cleanup': () => this.cleanupOldSessions(),
      'maintenance': () => this.runMaintenance()
    };

    const taskFunction = taskMap[taskName];
    if (!taskFunction) {
      throw new Error(`Unknown task: ${taskName}`);
    }

    if (this.isRunning) {
      throw new Error('Another task is currently running');
    }

    logger.info({ taskName }, 'Manually triggering task');
    await taskFunction();
  }
}

module.exports = ScheduledDataCollectionService;
