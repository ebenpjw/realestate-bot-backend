const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const config = require('../config');
const logger = require('../logger');
const whatsappService = require('./whatsappService');

/**
 * Floor Plan Delivery Service
 * 
 * Handles on-demand floor plan image download and WhatsApp delivery:
 * 1. Temporarily downloads floor plan images from stored URLs
 * 2. Sends images directly via WhatsApp API
 * 3. Deletes local image files immediately after successful delivery
 * 
 * Used by Layer 4 (Content Generation) when floor plans are requested
 */
class FloorPlanDeliveryService {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp/floorplans');
    this.maxFileSize = 5 * 1024 * 1024; // 5MB limit for WhatsApp
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.webp'];
    
    this.metrics = {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDownloads: 0,
      failedUploads: 0,
      averageProcessingTime: 0
    };
    
    // Ensure temp directory exists
    this._ensureTempDirectory();
    
    logger.info('Floor Plan Delivery Service initialized');
  }

  /**
   * Deliver floor plan images to WhatsApp lead
   * @param {string} senderWaId - WhatsApp ID of recipient
   * @param {Array} floorPlanImages - Array of floor plan image objects
   * @param {string} propertyContext - Context message about the property
   * @returns {Promise<Object>} Delivery result
   */
  async deliverFloorPlans(senderWaId, floorPlanImages, propertyContext = '') {
    const startTime = Date.now();
    const operationId = `floorplan-delivery-${senderWaId}-${Date.now()}`;
    
    try {
      this.metrics.totalDeliveries++;
      
      logger.info({
        operationId,
        senderWaId,
        imageCount: floorPlanImages?.length || 0
      }, 'Starting floor plan delivery');

      if (!floorPlanImages || floorPlanImages.length === 0) {
        return { success: false, error: 'No floor plan images provided' };
      }

      const deliveryResults = [];
      
      // Send context message first if provided
      if (propertyContext) {
        await whatsappService.sendMessage(senderWaId, propertyContext);
      }

      // Process each floor plan image
      for (const [index, floorPlan] of floorPlanImages.entries()) {
        try {
          const result = await this._processFloorPlanImage(senderWaId, floorPlan, operationId, index);
          deliveryResults.push(result);
          
          // Add small delay between images to avoid rate limiting
          if (index < floorPlanImages.length - 1) {
            await this._delay(1000);
          }
          
        } catch (error) {
          logger.error({
            err: error,
            operationId,
            floorPlanId: floorPlan.id,
            imageUrl: floorPlan.imageUrl
          }, 'Error processing individual floor plan');
          
          deliveryResults.push({
            success: false,
            floorPlanId: floorPlan.id,
            error: error.message
          });
        }
      }

      const successCount = deliveryResults.filter(r => r.success).length;
      const processingTime = Date.now() - startTime;
      
      // Update metrics
      this.metrics.successfulDeliveries += successCount;
      this.metrics.averageProcessingTime = this._updateAverageTime(processingTime);
      
      logger.info({
        operationId,
        successCount,
        totalCount: floorPlanImages.length,
        processingTime
      }, 'Floor plan delivery completed');

      return {
        success: successCount > 0,
        deliveredCount: successCount,
        totalCount: floorPlanImages.length,
        results: deliveryResults,
        processingTime
      };

    } catch (error) {
      logger.error({
        err: error,
        operationId,
        senderWaId
      }, 'Floor plan delivery failed');
      
      return {
        success: false,
        error: error.message,
        deliveredCount: 0,
        totalCount: floorPlanImages?.length || 0
      };
    }
  }

  /**
   * Process individual floor plan image
   * @private
   */
  async _processFloorPlanImage(senderWaId, floorPlan, operationId, index) {
    const imageId = `${operationId}-${index}`;
    let localFilePath = null;
    
    try {
      // Step 1: Download image temporarily
      localFilePath = await this._downloadImage(floorPlan.imageUrl, imageId);
      
      // Step 2: Validate image
      const validation = await this._validateImage(localFilePath);
      if (!validation.valid) {
        throw new Error(`Image validation failed: ${validation.error}`);
      }
      
      // Step 3: Send via WhatsApp
      const caption = this._generateImageCaption(floorPlan);
      await whatsappService.sendImage(senderWaId, localFilePath, caption);
      
      logger.debug({
        operationId,
        floorPlanId: floorPlan.id,
        propertyName: floorPlan.propertyName
      }, 'Floor plan image sent successfully');
      
      return {
        success: true,
        floorPlanId: floorPlan.id,
        propertyName: floorPlan.propertyName,
        caption
      };
      
    } catch (error) {
      this.metrics.failedUploads++;
      throw error;
      
    } finally {
      // Step 4: Clean up temporary file
      if (localFilePath) {
        await this._cleanupTempFile(localFilePath);
      }
    }
  }

  /**
   * Download image from URL to temporary location
   * @private
   */
  async _downloadImage(imageUrl, imageId) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(imageUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      const fileExtension = path.extname(urlObj.pathname) || '.jpg';
      const fileName = `${imageId}${fileExtension}`;
      const filePath = path.join(this.tempDir, fileName);
      
      logger.debug({ imageUrl, filePath }, 'Downloading floor plan image');
      
      const request = client.get(imageUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        // Check content length
        const contentLength = parseInt(response.headers['content-length'] || '0');
        if (contentLength > this.maxFileSize) {
          reject(new Error(`Image too large: ${contentLength} bytes`));
          return;
        }
        
        const fileStream = require('fs').createWriteStream(filePath);
        let downloadedBytes = 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (downloadedBytes > this.maxFileSize) {
            fileStream.destroy();
            reject(new Error('Image too large during download'));
            return;
          }
        });
        
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(filePath);
        });
        
        fileStream.on('error', (error) => {
          reject(error);
        });
      });
      
      request.on('error', (error) => {
        this.metrics.failedDownloads++;
        reject(error);
      });
      
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Validate downloaded image
   * @private
   */
  async _validateImage(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const fileExtension = path.extname(filePath).toLowerCase();
      
      // Check file size
      if (stats.size > this.maxFileSize) {
        return { valid: false, error: 'File too large' };
      }
      
      // Check file format
      if (!this.supportedFormats.includes(fileExtension)) {
        return { valid: false, error: 'Unsupported format' };
      }
      
      // Check if file is not empty
      if (stats.size === 0) {
        return { valid: false, error: 'Empty file' };
      }
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Generate caption for floor plan image
   * @private
   */
  _generateImageCaption(floorPlan) {
    let caption = `📐 Floor Plan - ${floorPlan.propertyName}`;
    
    if (floorPlan.analysis) {
      const analysis = floorPlan.analysis;
      if (analysis.room_count) {
        caption += `\n🏠 ${analysis.room_count} Bedroom`;
      }
      if (analysis.square_footage) {
        caption += `\n📏 ${analysis.square_footage} sqft`;
      }
      if (analysis.layout_type) {
        caption += `\n🏗️ ${analysis.layout_type} Layout`;
      }
    }
    
    return caption;
  }

  /**
   * Clean up temporary file
   * @private
   */
  async _cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.debug({ filePath }, 'Temporary file cleaned up');
    } catch (error) {
      logger.warn({ err: error, filePath }, 'Failed to cleanup temporary file');
    }
  }

  /**
   * Ensure temp directory exists
   * @private
   */
  async _ensureTempDirectory() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error({ err: error, tempDir: this.tempDir }, 'Failed to create temp directory');
    }
  }

  /**
   * Add delay between operations
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update average processing time
   * @private
   */
  _updateAverageTime(newTime) {
    if (this.metrics.totalDeliveries === 1) {
      return newTime;
    }
    
    return (this.metrics.averageProcessingTime * (this.metrics.totalDeliveries - 1) + newTime) / this.metrics.totalDeliveries;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalDeliveries > 0 ? 
        (this.metrics.successfulDeliveries / this.metrics.totalDeliveries) : 0,
      downloadFailureRate: this.metrics.totalDeliveries > 0 ? 
        (this.metrics.failedDownloads / this.metrics.totalDeliveries) : 0,
      uploadFailureRate: this.metrics.totalDeliveries > 0 ? 
        (this.metrics.failedUploads / this.metrics.totalDeliveries) : 0
    };
  }

  /**
   * Clean up all temporary files (maintenance function)
   */
  async cleanupAllTempFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const cleanupPromises = files.map(file => 
        this._cleanupTempFile(path.join(this.tempDir, file))
      );
      
      await Promise.all(cleanupPromises);
      logger.info({ fileCount: files.length }, 'All temporary files cleaned up');
      
    } catch (error) {
      logger.error({ err: error }, 'Error during temp file cleanup');
    }
  }
}

module.exports = new FloorPlanDeliveryService();
