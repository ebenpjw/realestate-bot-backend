/**
 * Phone number utilities for formatting and communication actions
 */

/**
 * Clean phone number by removing all non-digit characters
 */
export function cleanPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '')
}

/**
 * Format phone number with country code
 * Defaults to Singapore (+65) if no country code is present
 */
export function formatPhoneWithCountryCode(phoneNumber: string): string {
  const cleaned = cleanPhoneNumber(phoneNumber)
  
  // If already has country code (starts with country code digits)
  if (cleaned.startsWith('65') && cleaned.length >= 10) {
    return `+${cleaned}`
  }
  
  // If starts with + but missing digits
  if (phoneNumber.startsWith('+')) {
    return phoneNumber
  }
  
  // Default to Singapore country code
  return `+65${cleaned}`
}

/**
 * Format phone number for tel: protocol
 */
export function formatPhoneForTel(phoneNumber: string): string {
  return `tel:${formatPhoneWithCountryCode(phoneNumber)}`
}

/**
 * Format phone number for WhatsApp (remove + and spaces)
 */
export function formatPhoneForWhatsApp(phoneNumber: string): string {
  const formatted = formatPhoneWithCountryCode(phoneNumber)
  return formatted.replace(/\+/g, '').replace(/\s/g, '')
}

/**
 * Generate WhatsApp URL with pre-composed message
 */
export function generateWhatsAppUrl(phoneNumber: string, leadName?: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phoneNumber)
  
  const message = leadName 
    ? `Hi ${leadName}, this is your property consultant. I hope you're doing well! I wanted to follow up on your property inquiry. Is there anything specific I can help you with regarding your property search? 😊`
    : `Hi there, this is your property consultant. I hope you're doing well! I wanted to follow up on your property inquiry. Is there anything specific I can help you with regarding your property search? 😊`
  
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`
}

/**
 * Open WhatsApp with pre-composed message
 */
export function openWhatsApp(phoneNumber: string, leadName?: string): void {
  const url = generateWhatsAppUrl(phoneNumber, leadName)
  window.open(url, '_blank')
}

/**
 * Initiate phone call
 */
export function initiateCall(phoneNumber: string): void {
  const telUrl = formatPhoneForTel(phoneNumber)
  window.location.href = telUrl
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const cleaned = cleanPhoneNumber(phoneNumber)
  // Singapore phone numbers are typically 8 digits, with country code it's 10-11 digits
  return cleaned.length >= 8 && cleaned.length <= 15
}

/**
 * Display formatted phone number for UI
 */
export function displayPhoneNumber(phoneNumber: string): string {
  const formatted = formatPhoneWithCountryCode(phoneNumber)
  
  // Format Singapore numbers nicely: +65 9123 4567
  if (formatted.startsWith('+65')) {
    const number = formatted.substring(3)
    if (number.length === 8) {
      return `+65 ${number.substring(0, 4)} ${number.substring(4)}`
    }
  }
  
  return formatted
}
