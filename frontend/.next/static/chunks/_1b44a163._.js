(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push([typeof document === "object" ? document.currentScript : undefined, {

"[project]/lib/utils/errorHandling.ts [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "AppError": ()=>AppError,
    "AuthenticationError": ()=>AuthenticationError,
    "AuthorizationError": ()=>AuthorizationError,
    "IntegrationError": ()=>IntegrationError,
    "NetworkError": ()=>NetworkError,
    "ValidationError": ()=>ValidationError,
    "WABAError": ()=>WABAError,
    "createErrorBoundaryHandler": ()=>createErrorBoundaryHandler,
    "getErrorMessage": ()=>getErrorMessage,
    "handleApiError": ()=>handleApiError,
    "handleMultiTenantError": ()=>handleMultiTenantError,
    "handleWABAError": ()=>handleWABAError,
    "isOnline": ()=>isOnline,
    "logError": ()=>logError,
    "onConnectionChange": ()=>onConnectionChange,
    "showErrorToast": ()=>showErrorToast,
    "showInfoToast": ()=>showInfoToast,
    "showSuccessToast": ()=>showSuccessToast,
    "showWarningToast": ()=>showWarningToast,
    "validateEmail": ()=>validateEmail,
    "validatePassword": ()=>validatePassword,
    "validatePhoneNumber": ()=>validatePhoneNumber,
    "validateRequired": ()=>validateRequired,
    "withRetry": ()=>withRetry
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
;
;
class AppError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', status = 500, details){
        super(message), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "code", void 0), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "status", void 0), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "details", void 0);
        this.name = 'AppError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
class ValidationError extends AppError {
    constructor(message, details){
        super(message, 'VALIDATION_ERROR', 400, details);
        this.name = 'ValidationError';
    }
}
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required'){
        super(message, 'AUTHENTICATION_ERROR', 401);
        this.name = 'AuthenticationError';
    }
}
class AuthorizationError extends AppError {
    constructor(message = 'Access denied'){
        super(message, 'AUTHORIZATION_ERROR', 403);
        this.name = 'AuthorizationError';
    }
}
class NetworkError extends AppError {
    constructor(message = 'Network error occurred'){
        super(message, 'NETWORK_ERROR', 0);
        this.name = 'NetworkError';
    }
}
class WABAError extends AppError {
    constructor(message, details){
        super(message, 'WABA_ERROR', 500, details);
        this.name = 'WABAError';
    }
}
class IntegrationError extends AppError {
    constructor(service, message, details){
        super("".concat(service, " integration error: ").concat(message), 'INTEGRATION_ERROR', 500, details);
        this.name = 'IntegrationError';
    }
}
function handleApiError(error) {
    // Handle Axios errors
    if (error.response) {
        const { status, data } = error.response;
        const message = (data === null || data === void 0 ? void 0 : data.error) || (data === null || data === void 0 ? void 0 : data.message) || 'An error occurred';
        const code = (data === null || data === void 0 ? void 0 : data.code) || "HTTP_".concat(status);
        return new AppError(message, code, status, data);
    }
    // Handle network errors
    if (error.request) {
        return new NetworkError('Unable to connect to server');
    }
    // Handle custom app errors
    if (error instanceof AppError) {
        return error;
    }
    // Handle generic errors
    return new AppError(error.message || 'An unexpected error occurred');
}
function getErrorMessage(error) {
    var _error_response_data, _error_response, _error_response_data1, _error_response1;
    if (error instanceof AppError) {
        return error.message;
    }
    if (error === null || error === void 0 ? void 0 : (_error_response = error.response) === null || _error_response === void 0 ? void 0 : (_error_response_data = _error_response.data) === null || _error_response_data === void 0 ? void 0 : _error_response_data.error) {
        return error.response.data.error;
    }
    if (error === null || error === void 0 ? void 0 : (_error_response1 = error.response) === null || _error_response1 === void 0 ? void 0 : (_error_response_data1 = _error_response1.data) === null || _error_response_data1 === void 0 ? void 0 : _error_response_data1.message) {
        return error.response.data.message;
    }
    if (error === null || error === void 0 ? void 0 : error.message) {
        return error.message;
    }
    return 'An unexpected error occurred';
}
function showErrorToast(error) {
    let title = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'Error';
    const message = getErrorMessage(error);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error(title, {
        description: message,
        duration: 5000
    });
}
function showSuccessToast(title, description) {
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success(title, {
        description,
        duration: 3000
    });
}
function showWarningToast(title, description) {
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].warning(title, {
        description,
        duration: 4000
    });
}
function showInfoToast(title, description) {
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].info(title, {
        description,
        duration: 3000
    });
}
async function withRetry(fn) {
    let maxRetries = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 3, delay = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 1000;
    let lastError;
    for(let attempt = 1; attempt <= maxRetries; attempt++){
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt === maxRetries) {
                break;
            }
            // Don't retry on authentication/authorization errors
            if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
                break;
            }
            // Don't retry on validation errors
            if (error instanceof ValidationError) {
                break;
            }
            // Wait before retrying
            await new Promise((resolve)=>setTimeout(resolve, delay * attempt));
        }
    }
    throw lastError;
}
function validateRequired(value, fieldName) {
    if (!value || typeof value === 'string' && value.trim() === '') {
        throw new ValidationError("".concat(fieldName, " is required"));
    }
}
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ValidationError('Please enter a valid email address');
    }
}
function validatePhoneNumber(phone) {
    // Singapore phone number validation
    const phoneRegex = /^(\+65)?[689]\d{7}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        throw new ValidationError('Please enter a valid Singapore phone number');
    }
}
function validatePassword(password) {
    if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        throw new ValidationError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }
}
function isOnline() {
    return navigator.onLine;
}
function onConnectionChange(callback) {
    const handleOnline = ()=>callback(true);
    const handleOffline = ()=>callback(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return ()=>{
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
}
function logError(error, context) {
    console.error("[".concat(context || 'App', "] Error:"), error);
    // In production, you might want to send this to an error tracking service
    if (("TURBOPACK compile-time value", "development") === 'production') {
    // Example: Sentry.captureException(error, { tags: { context } })
    }
}
function createErrorBoundaryHandler(context) {
    return (error, errorInfo)=>{
        logError(error, context);
        // Show user-friendly error message
        showErrorToast(error, 'Something went wrong');
    };
}
function handleMultiTenantError(error, agentId) {
    const appError = handleApiError(error);
    // Add agent context to error
    if (agentId) {
        appError.details = {
            ...appError.details,
            agentId,
            timestamp: new Date().toISOString()
        };
    }
    // Handle specific multi-tenant errors
    if (appError.code === 'AGENT_ACCESS_DENIED') {
        return new AuthorizationError('You can only access your own data');
    }
    if (appError.code === 'WABA_NOT_CONFIGURED') {
        return new WABAError('WhatsApp Business API is not configured for this agent');
    }
    return appError;
}
function handleWABAError(error) {
    const message = getErrorMessage(error);
    if (message.includes('invalid credentials')) {
        return new WABAError('Invalid WABA credentials. Please check your API key and App ID.');
    }
    if (message.includes('rate limit')) {
        return new WABAError('WABA rate limit exceeded. Please try again later.');
    }
    if (message.includes('template not approved')) {
        return new WABAError('Message template is not approved. Please use an approved template.');
    }
    return new WABAError(message);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/lib/api/client.ts [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "apiClient": ()=>apiClient
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/axios/lib/axios.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2f$errorHandling$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils/errorHandling.ts [app-client] (ecmascript)");
;
;
;
;
// Environment-based API configuration
const getApiBaseUrl = ()=>{
    if ("TURBOPACK compile-time truthy", 1) {
        // Client-side: use environment variable or detect from window location
        return ("TURBOPACK compile-time value", "http://localhost:8080") || (window.location.hostname === 'localhost' ? 'http://localhost:8080' : "".concat(window.location.protocol, "//").concat(window.location.hostname, ":8080"));
    }
    //TURBOPACK unreachable
    ;
};
const API_BASE_URL = getApiBaseUrl();
class ApiClient {
    setupInterceptors() {
        // Request interceptor to add auth token and request ID
        this.client.interceptors.request.use((config)=>{
            // Add auth token
            const token = localStorage.getItem('auth_token');
            if (token) {
                config.headers.Authorization = "Bearer ".concat(token);
            }
            // Add request ID for tracing
            config.headers['X-Request-ID'] = crypto.randomUUID();
            // Add timestamp
            config.headers['X-Request-Time'] = new Date().toISOString();
            return config;
        }, (error)=>{
            return Promise.reject(this.normalizeError(error));
        });
        // Response interceptor for error handling and token refresh
        this.client.interceptors.response.use((response)=>{
            // Log successful responses in development
            if ("TURBOPACK compile-time truthy", 1) {
                var _response_config_method;
                console.log("✅ ".concat((_response_config_method = response.config.method) === null || _response_config_method === void 0 ? void 0 : _response_config_method.toUpperCase(), " ").concat(response.config.url), {
                    status: response.status,
                    data: response.data
                });
            }
            return response;
        }, async (error)=>{
            var _error_response;
            const originalRequest = error.config;
            // Handle 401 errors (unauthorized) with token refresh
            if (((_error_response = error.response) === null || _error_response === void 0 ? void 0 : _error_response.status) === 401 && !originalRequest._retry) {
                originalRequest._retry = true;
                try {
                    // Prevent multiple refresh requests
                    if (!this.refreshPromise) {
                        this.refreshPromise = this.refreshToken();
                    }
                    const newToken = await this.refreshPromise;
                    this.refreshPromise = null;
                    if (newToken && originalRequest.headers) {
                        originalRequest.headers.Authorization = "Bearer ".concat(newToken);
                        return this.client(originalRequest);
                    }
                } catch (refreshError) {
                    this.refreshPromise = null;
                    this.handleAuthFailure();
                    return Promise.reject(this.normalizeError(refreshError));
                }
            }
            // Handle network errors
            if (!error.response) {
                const networkError = this.createNetworkError(error);
                this.showErrorToast(networkError, originalRequest);
                return Promise.reject(networkError);
            }
            // Handle other errors
            const normalizedError = this.normalizeError(error);
            this.showErrorToast(normalizedError, originalRequest);
            return Promise.reject(normalizedError);
        });
    }
    async refreshToken() {
        try {
            const response = await this.client.post('/api/frontend-auth/refresh');
            const newToken = response.data.token;
            localStorage.setItem('auth_token', newToken);
            return newToken;
        } catch (error) {
            throw error;
        }
    }
    handleAuthFailure() {
        localStorage.removeItem('auth_token');
        // Only redirect if we're in the browser and not already on login page
        if ("object" !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
            window.location.href = '/auth/login';
        }
    }
    normalizeError(error) {
        // Use the enhanced error handling utility
        const appError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2f$errorHandling$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["handleApiError"])(error);
        return {
            message: appError.message,
            status: appError.status,
            code: appError.code,
            details: appError.details
        };
    }
    createNetworkError(error) {
        return {
            message: 'Network error. Please check your connection and try again.',
            code: 'NETWORK_ERROR'
        };
    }
    showErrorToast(error, originalRequest) {
        // Don't show toast for certain endpoints
        const silentEndpoints = [
            '/auth/me',
            '/auth/refresh',
            '/frontend-auth/refresh'
        ];
        const isSilentEndpoint = silentEndpoints.some((endpoint)=>{
            var _originalRequest_url;
            return originalRequest === null || originalRequest === void 0 ? void 0 : (_originalRequest_url = originalRequest.url) === null || _originalRequest_url === void 0 ? void 0 : _originalRequest_url.includes(endpoint);
        });
        if (!isSilentEndpoint && error.status && error.status >= 400) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error(error.message, {
                id: "error-".concat(error.status, "-").concat(originalRequest === null || originalRequest === void 0 ? void 0 : originalRequest.url)
            });
        }
    }
    getErrorMessage(error) {
        const response = error.response;
        // Try to get message from response data
        if ((response === null || response === void 0 ? void 0 : response.data) && typeof response.data === 'object') {
            const data = response.data;
            if (data.message) return data.message;
            if (data.error) return data.error;
            if (data.detail) return data.detail;
        }
        // Fallback to status-based messages
        switch(response === null || response === void 0 ? void 0 : response.status){
            case 400:
                return 'Bad request. Please check your input.';
            case 401:
                return 'Authentication required. Please log in.';
            case 403:
                return 'Access denied. You don\'t have permission for this action.';
            case 404:
                return 'Resource not found.';
            case 409:
                return 'Conflict. The resource already exists or is in use.';
            case 422:
                return 'Validation error. Please check your input.';
            case 429:
                return 'Too many requests. Please try again later.';
            case 500:
                return 'Server error. Please try again later.';
            case 502:
                return 'Bad gateway. The server is temporarily unavailable.';
            case 503:
                return 'Service unavailable. Please try again later.';
            case 504:
                return 'Gateway timeout. The request took too long to process.';
            default:
                return error.message || 'An unexpected error occurred.';
        }
    }
    // HTTP methods
    async get(url, config) {
        return this.client.get(url, config);
    }
    async post(url, data, config) {
        return this.client.post(url, data, config);
    }
    async put(url, data, config) {
        return this.client.put(url, data, config);
    }
    async patch(url, data, config) {
        return this.client.patch(url, data, config);
    }
    async delete(url, config) {
        return this.client.delete(url, config);
    }
    // File upload helper
    async uploadFile(url, file, onProgress) {
        const formData = new FormData();
        formData.append('file', file);
        return this.client.post(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent)=>{
                if (onProgress && progressEvent.total) {
                    const progress = Math.round(progressEvent.loaded * 100 / progressEvent.total);
                    onProgress(progress);
                }
            }
        });
    }
    constructor(){
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "client", void 0);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "refreshPromise", null);
        this.client = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].create({
            baseURL: API_BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            },
            withCredentials: false
        });
        this.setupInterceptors();
    }
}
const apiClient = new ApiClient();
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/lib/auth/authApi.ts [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "authApi": ()=>authApi
});
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api/client.ts [app-client] (ecmascript)");
;
class AuthApi {
    async login(email, password) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/frontend-auth/login', {
            email,
            password
        });
        return response.data;
    }
    async logout() {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/frontend-auth/logout');
    }
    async getCurrentUser() {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/frontend-auth/me');
        return response.data.data;
    }
    async refreshToken() {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/frontend-auth/refresh');
        return response.data;
    }
    async requestPasswordReset(email) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/auth/forgot-password', {
            email
        });
    }
    async resetPassword(token, password) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/auth/reset-password', {
            token,
            password
        });
    }
    async changePassword(currentPassword, newPassword) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/frontend-auth/change-password', {
            current_password: currentPassword,
            new_password: newPassword
        });
    }
    async updateProfile(data) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].patch('/api/frontend-auth/profile', data);
        return response.data.data;
    }
    // OAuth integration endpoints
    async initiateGoogleAuth(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get("/api/auth/google?agentId=".concat(agentId));
        return response.data;
    }
    async initiateZoomAuth(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get("/api/auth/zoom?agentId=".concat(agentId));
        return response.data;
    }
    async getOAuthStatus(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get("/api/auth/oauth-status/".concat(agentId));
        return response.data;
    }
}
const authApi = new AuthApi();
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/lib/auth/AuthContext.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "AuthProvider": ()=>AuthProvider,
    "useAuth": ()=>useAuth
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$authApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth/authApi.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function useAuth() {
    _s();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
_s(useAuth, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
function AuthProvider(param) {
    let { children } = param;
    _s1();
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [tokenRefreshTimer, setTokenRefreshTimer] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    // Check for existing session on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            checkAuthStatus();
        }
    }["AuthProvider.useEffect"], []);
    // Cleanup timer on unmount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            return ({
                "AuthProvider.useEffect": ()=>{
                    if (tokenRefreshTimer) {
                        clearTimeout(tokenRefreshTimer);
                    }
                }
            })["AuthProvider.useEffect"];
        }
    }["AuthProvider.useEffect"], [
        tokenRefreshTimer
    ]);
    const checkAuthStatus = async ()=>{
        try {
            // Check if we're on the client side
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            const token = localStorage.getItem('auth_token');
            if (!token) {
                setLoading(false);
                return;
            }
            // Check if token is expired
            if (isTokenExpired(token)) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    await logout();
                    return;
                }
            }
            const userData = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$authApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authApi"].getCurrentUser();
            setUser(userData);
            setupTokenRefresh(token);
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('auth_token');
        } finally{
            setLoading(false);
        }
    };
    const isTokenExpired = (token)=>{
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return true;
            const payload = JSON.parse(atob(parts[1]));
            const currentTime = Date.now() / 1000;
            // Check if token expires within 5 minutes
            return payload.exp < currentTime + 300;
        } catch (e) {
            return true;
        }
    };
    const setupTokenRefresh = (token)=>{
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return;
            const payload = JSON.parse(atob(parts[1]));
            const currentTime = Date.now() / 1000;
            const timeUntilRefresh = (payload.exp - currentTime - 300) * 1000 // Refresh 5 minutes before expiry
            ;
            if (timeUntilRefresh > 0) {
                if (tokenRefreshTimer) {
                    clearTimeout(tokenRefreshTimer);
                }
                const timer = setTimeout(async ()=>{
                    try {
                        await refreshToken();
                    } catch (error) {
                        console.error('Automatic token refresh failed:', error);
                        await logout();
                    }
                }, timeUntilRefresh);
                setTokenRefreshTimer(timer);
            }
        } catch (error) {
            console.error('Failed to setup token refresh:', error);
        }
    };
    const refreshToken = async ()=>{
        try {
            const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$authApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authApi"].refreshToken();
            localStorage.setItem('auth_token', response.token);
            setUser(response.user);
            setupTokenRefresh(response.token);
            return response.token;
        } catch (error) {
            throw error;
        }
    };
    const login = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[login]": async (email, password)=>{
            try {
                setLoading(true);
                const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$authApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authApi"].login(email, password);
                localStorage.setItem('auth_token', response.token);
                setUser(response.user);
                setupTokenRefresh(response.token);
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success('Welcome back!', {
                    description: "Logged in as ".concat(response.user.full_name)
                });
                // Redirect based on role
                if (response.user.role === 'admin') {
                    router.push('/admin/dashboard');
                } else {
                    router.push('/agent/dashboard');
                }
            } catch (error) {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error('Login failed', {
                    description: error.message || 'Please check your credentials and try again'
                });
                throw error;
            } finally{
                setLoading(false);
            }
        }
    }["AuthProvider.useCallback[login]"], [
        router
    ]);
    const logout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[logout]": async ()=>{
            try {
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$authApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authApi"].logout();
            } catch (error) {
                console.error('Logout error:', error);
            } finally{
                // Clear token refresh timer
                if (tokenRefreshTimer) {
                    clearTimeout(tokenRefreshTimer);
                    setTokenRefreshTimer(null);
                }
                localStorage.removeItem('auth_token');
                setUser(null);
                router.push('/auth/login');
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success('Logged out successfully', {
                    description: 'You have been securely logged out'
                });
            }
        }
    }["AuthProvider.useCallback[logout]"], [
        router,
        tokenRefreshTimer
    ]);
    const refreshUser = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[refreshUser]": async ()=>{
            try {
                const userData = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$authApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authApi"].getCurrentUser();
                setUser(userData);
            } catch (error) {
                console.error('Failed to refresh user:', error);
                logout();
            }
        }
    }["AuthProvider.useCallback[refreshUser]"], [
        logout
    ]);
    const hasPermission = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[hasPermission]": (permission)=>{
            if (!user) return false;
            return user.permissions.includes(permission) || user.role === 'admin';
        }
    }["AuthProvider.useCallback[hasPermission]"], [
        user
    ]);
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AuthProvider.useMemo[value]": ()=>({
                user,
                loading,
                login,
                logout,
                refreshUser,
                isAuthenticated: !!user,
                hasPermission,
                isAgent: (user === null || user === void 0 ? void 0 : user.role) === 'agent',
                isAdmin: (user === null || user === void 0 ? void 0 : user.role) === 'admin'
            })
    }["AuthProvider.useMemo[value]"], [
        user,
        loading,
        login,
        logout,
        refreshUser,
        hasPermission
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/lib/auth/AuthContext.tsx",
        lineNumber: 234,
        columnNumber: 5
    }, this);
}
_s1(AuthProvider, "KGw7WRhec2pdKLrg8f14soE30vU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = AuthProvider;
var _c;
__turbopack_context__.k.register(_c, "AuthProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/lib/socket/SocketContext.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "SocketProvider": ()=>SocketProvider,
    "useSocket": ()=>useSocket
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/socket.io-client/build/esm/index.js [app-client] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/socket.io-client/build/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const SocketContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function useSocket() {
    _s();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(SocketContext);
    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
}
_s(useSocket, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
function SocketProvider(param) {
    let { children } = param;
    _s1();
    const [socket, setSocket] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [connected, setConnected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const { user, isAuthenticated } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SocketProvider.useEffect": ()=>{
            setMounted(true);
        }
    }["SocketProvider.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SocketProvider.useEffect": ()=>{
            // Only initialize socket on client side
            if (!mounted || "object" === 'undefined') return;
            if (!isAuthenticated || !user) {
                if (socket) {
                    socket.disconnect();
                    setSocket(null);
                    setConnected(false);
                }
                return;
            }
            // Initialize socket connection
            const WS_URL = ("TURBOPACK compile-time value", "ws://localhost:8080") || 'ws://localhost:8080';
            const token = localStorage.getItem('auth_token');
            const newSocket = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["io"])(WS_URL, {
                auth: {
                    token,
                    userId: user.id,
                    role: user.role
                },
                transports: [
                    'websocket',
                    'polling'
                ],
                timeout: 20000
            });
            // Connection event handlers
            newSocket.on('connect', {
                "SocketProvider.useEffect": ()=>{
                    console.log('Socket connected:', newSocket.id);
                    setConnected(true);
                    // Join user-specific room
                    newSocket.emit('join_user_room', user.id);
                    // Join role-specific room
                    if (user.role === 'agent') {
                        newSocket.emit('join_agent_room', user.id);
                    } else if (user.role === 'admin') {
                        newSocket.emit('join_admin_room', user.organization_id);
                    }
                }
            }["SocketProvider.useEffect"]);
            newSocket.on('disconnect', {
                "SocketProvider.useEffect": (reason)=>{
                    console.log('Socket disconnected:', reason);
                    setConnected(false);
                }
            }["SocketProvider.useEffect"]);
            newSocket.on('connect_error', {
                "SocketProvider.useEffect": (error)=>{
                    console.error('Socket connection error:', error);
                    setConnected(false);
                }
            }["SocketProvider.useEffect"]);
            // Real-time event handlers
            newSocket.on('new_message', {
                "SocketProvider.useEffect": (data)=>{
                    // Handle new message notifications
                    if (data.agentId === user.id || user.role === 'admin') {
                        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success("New message from ".concat(data.leadName || data.phoneNumber));
                    }
                }
            }["SocketProvider.useEffect"]);
            newSocket.on('lead_status_changed', {
                "SocketProvider.useEffect": (data)=>{
                    // Handle lead status changes
                    if (data.agentId === user.id || user.role === 'admin') {
                        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success("Lead ".concat(data.leadName, " status changed to ").concat(data.status));
                    }
                }
            }["SocketProvider.useEffect"]);
            newSocket.on('appointment_booked', {
                "SocketProvider.useEffect": (data)=>{
                    // Handle appointment bookings
                    if (data.agentId === user.id || user.role === 'admin') {
                        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success("New appointment booked with ".concat(data.leadName));
                    }
                }
            }["SocketProvider.useEffect"]);
            newSocket.on('system_notification', {
                "SocketProvider.useEffect": (data)=>{
                    // Handle system-wide notifications
                    switch(data.type){
                        case 'info':
                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success(data.message);
                            break;
                        case 'warning':
                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error(data.message);
                            break;
                        case 'error':
                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error(data.message);
                            break;
                        default:
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"])(data.message);
                    }
                }
            }["SocketProvider.useEffect"]);
            newSocket.on('agent_status_changed', {
                "SocketProvider.useEffect": (data)=>{
                    // Handle agent status changes (for admin)
                    if (user.role === 'admin') {
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"])("Agent ".concat(data.agentName, " is now ").concat(data.status));
                    }
                }
            }["SocketProvider.useEffect"]);
            setSocket(newSocket);
            // Cleanup on unmount
            return ({
                "SocketProvider.useEffect": ()=>{
                    newSocket.disconnect();
                    setSocket(null);
                    setConnected(false);
                }
            })["SocketProvider.useEffect"];
        }
    }["SocketProvider.useEffect"], [
        isAuthenticated,
        user
    ]);
    const joinRoom = (room)=>{
        if (socket && connected) {
            socket.emit('join_room', room);
        }
    };
    const leaveRoom = (room)=>{
        if (socket && connected) {
            socket.emit('leave_room', room);
        }
    };
    const emit = (event, data)=>{
        if (socket && connected) {
            socket.emit(event, data);
        }
    };
    const value = {
        socket,
        connected,
        joinRoom,
        leaveRoom,
        emit
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SocketContext.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/lib/socket/SocketContext.tsx",
        lineNumber: 176,
        columnNumber: 5
    }, this);
}
_s1(SocketProvider, "XpOqduRTey69HCTJ6uydSzYzKG0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = SocketProvider;
var _c;
__turbopack_context__.k.register(_c, "SocketProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/lib/api/services/integrationsApi.ts [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "integrationsApi": ()=>integrationsApi
});
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api/client.ts [app-client] (ecmascript)");
;
class IntegrationsApi {
    /**
   * Get all integration statuses for an agent
   */ async getIntegrationStatus(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/dashboard/integrations/status', {
            params: {
                agentId
            }
        });
        return response.data.data;
    }
    /**
   * Get WABA integration details
   */ async getWABAIntegration(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/dashboard/integrations/waba', {
            params: {
                agentId
            }
        });
        return response.data.data;
    }
    /**
   * Connect WABA integration
   */ async connectWABA(request) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/integrations/waba/connect', request);
        return response.data.data;
    }
    /**
   * Update WABA integration
   */ async updateWABA(request) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].patch('/api/integrations/waba', request);
        return response.data.data;
    }
    /**
   * Disconnect WABA integration
   */ async disconnectWABA() {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/integrations/waba/disconnect');
    }
    /**
   * Test WABA connection
   */ async testWABAConnection(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/integrations/waba/test', {
            agentId
        });
        return response.data.data;
    }
    /**
   * Get WABA QR code for setup
   */ async getWABAQRCode() {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/integrations/waba/qr-code');
        return response.data.data;
    }
    /**
   * Get Google Calendar integration
   */ async getGoogleIntegration(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/integrations/google', {
            params: {
                agentId
            }
        });
        return response.data.data;
    }
    /**
   * Get Google OAuth URL
   */ async getGoogleAuthUrl(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/auth/google', {
            params: {
                agentId
            }
        });
        return response.data;
    }
    /**
   * Disconnect Google integration
   */ async disconnectGoogle() {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/integrations/google/disconnect');
    }
    /**
   * Test Google Calendar connection
   */ async testGoogleConnection(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/integrations/google/test', {
            agentId
        });
        return response.data.data;
    }
    /**
   * Get Zoom integration
   */ async getZoomIntegration(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/integrations/zoom', {
            params: {
                agentId
            }
        });
        return response.data.data;
    }
    /**
   * Get Zoom OAuth URL
   */ async getZoomAuthUrl(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/auth/zoom', {
            params: {
                agentId
            }
        });
        return response.data;
    }
    /**
   * Disconnect Zoom integration
   */ async disconnectZoom() {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/integrations/zoom/disconnect');
    }
    /**
   * Test Zoom connection
   */ async testZoomConnection(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/integrations/zoom/test', {
            agentId
        });
        return response.data.data;
    }
    /**
   * Update Zoom meeting settings
   */ async updateZoomSettings(settings) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].patch('/api/integrations/zoom/settings', settings);
        return response.data.data;
    }
    /**
   * Get Meta Business integration
   */ async getMetaBusinessIntegration(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/integrations/meta', {
            params: {
                agentId
            }
        });
        return response.data.data;
    }
    /**
   * Get Meta Business OAuth URL
   */ async getMetaAuthUrl() {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/integrations/meta/auth-url');
        return response.data;
    }
    /**
   * Disconnect Meta Business integration
   */ async disconnectMeta() {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/integrations/meta/disconnect');
    }
    /**
   * Sync all integrations
   */ async syncAllIntegrations(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].post('/api/integrations/sync-all', {
            agentId
        });
        return response.data.data;
    }
    /**
   * Get integration health check
   */ async getHealthCheck(agentId) {
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get('/api/integrations/health', {
            params: {
                agentId
            }
        });
        return response.data.data;
    }
}
const integrationsApi = new IntegrationsApi();
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/lib/contexts/WABAContext.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "WABAProvider": ()=>WABAProvider,
    "useWABA": ()=>useWABA
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$services$2f$integrationsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api/services/integrationsApi.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const WABAContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function useWABA() {
    _s();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(WABAContext);
    if (context === undefined) {
        throw new Error('useWABA must be used within a WABAProvider');
    }
    return context;
}
_s(useWABA, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
function WABAProvider(param) {
    let { children } = param;
    _s1();
    const [wabaConfig, setWabaConfig] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [templates, setTemplates] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const { user, isAuthenticated } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    // Load WABA configuration when user changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WABAProvider.useEffect": ()=>{
            if (isAuthenticated && user) {
                loadWABAConfig();
            } else {
                setWabaConfig(null);
                setTemplates([]);
                setLoading(false);
            }
        }
    }["WABAProvider.useEffect"], [
        isAuthenticated,
        user
    ]);
    const loadWABAConfig = async ()=>{
        try {
            setLoading(true);
            setError(null);
            const config = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$services$2f$integrationsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["integrationsApi"].getWABAIntegration(user === null || user === void 0 ? void 0 : user.id);
            setWabaConfig(config);
            // Load templates if WABA is connected
            if (config.status === 'connected' && config.templates) {
                setTemplates(config.templates.map((t)=>({
                        id: t.id,
                        name: t.name,
                        category: t.category,
                        status: t.status,
                        language: t.language,
                        content: ''
                    })));
            }
        } catch (err) {
            console.error('Failed to load WABA config:', err);
            setError(err.message || 'Failed to load WABA configuration');
        } finally{
            setLoading(false);
        }
    };
    const connectWABA = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WABAProvider.useCallback[connectWABA]": async (config)=>{
            try {
                setLoading(true);
                setError(null);
                const result = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$services$2f$integrationsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["integrationsApi"].connectWABA(config);
                setWabaConfig(result);
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success('WABA Connected', {
                    description: "Successfully connected WhatsApp Business API for ".concat(config.phoneNumber)
                });
                // Refresh templates after connection
                await refreshTemplates();
            } catch (err) {
                const errorMessage = err.message || 'Failed to connect WABA';
                setError(errorMessage);
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error('WABA Connection Failed', {
                    description: errorMessage
                });
                throw err;
            } finally{
                setLoading(false);
            }
        }
    }["WABAProvider.useCallback[connectWABA]"], []);
    const updateWABA = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WABAProvider.useCallback[updateWABA]": async (config)=>{
            try {
                setLoading(true);
                setError(null);
                const result = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$services$2f$integrationsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["integrationsApi"].updateWABA(config);
                setWabaConfig(result);
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success('WABA Updated', {
                    description: 'WhatsApp Business API configuration updated successfully'
                });
            } catch (err) {
                const errorMessage = err.message || 'Failed to update WABA';
                setError(errorMessage);
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error('WABA Update Failed', {
                    description: errorMessage
                });
                throw err;
            } finally{
                setLoading(false);
            }
        }
    }["WABAProvider.useCallback[updateWABA]"], []);
    const disconnectWABA = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WABAProvider.useCallback[disconnectWABA]": async ()=>{
            try {
                setLoading(true);
                setError(null);
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$services$2f$integrationsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["integrationsApi"].disconnectWABA();
                setWabaConfig(null);
                setTemplates([]);
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success('WABA Disconnected', {
                    description: 'WhatsApp Business API has been disconnected'
                });
            } catch (err) {
                const errorMessage = err.message || 'Failed to disconnect WABA';
                setError(errorMessage);
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error('WABA Disconnect Failed', {
                    description: errorMessage
                });
                throw err;
            } finally{
                setLoading(false);
            }
        }
    }["WABAProvider.useCallback[disconnectWABA]"], []);
    const testConnection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WABAProvider.useCallback[testConnection]": async ()=>{
            try {
                const result = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$services$2f$integrationsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["integrationsApi"].testWABAConnection(user === null || user === void 0 ? void 0 : user.id);
                if (result.success) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success('WABA Connection Test', {
                        description: result.message
                    });
                    return true;
                } else {
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error('WABA Connection Test Failed', {
                        description: result.message
                    });
                    return false;
                }
            } catch (err) {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error('WABA Connection Test Failed', {
                    description: err.message || 'Failed to test WABA connection'
                });
                return false;
            }
        }
    }["WABAProvider.useCallback[testConnection]"], [
        user === null || user === void 0 ? void 0 : user.id
    ]);
    const refreshTemplates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WABAProvider.useCallback[refreshTemplates]": async ()=>{
            try {
                if (!wabaConfig || wabaConfig.status !== 'connected') {
                    return;
                }
                const config = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$services$2f$integrationsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["integrationsApi"].getWABAIntegration(user === null || user === void 0 ? void 0 : user.id);
                if (config.templates) {
                    setTemplates(config.templates.map({
                        "WABAProvider.useCallback[refreshTemplates]": (t)=>({
                                id: t.id,
                                name: t.name,
                                category: t.category,
                                status: t.status,
                                language: t.language,
                                content: ''
                            })
                    }["WABAProvider.useCallback[refreshTemplates]"]));
                }
            } catch (err) {
                console.error('Failed to refresh templates:', err);
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error('Failed to refresh templates', {
                    description: err.message
                });
            }
        }
    }["WABAProvider.useCallback[refreshTemplates]"], [
        wabaConfig,
        user === null || user === void 0 ? void 0 : user.id
    ]);
    const getTemplate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WABAProvider.useCallback[getTemplate]": (templateId)=>{
            return templates.find({
                "WABAProvider.useCallback[getTemplate]": (t)=>t.id === templateId
            }["WABAProvider.useCallback[getTemplate]"]);
        }
    }["WABAProvider.useCallback[getTemplate]"], [
        templates
    ]);
    const refreshStatus = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WABAProvider.useCallback[refreshStatus]": async ()=>{
            await loadWABAConfig();
        }
    }["WABAProvider.useCallback[refreshStatus]"], []);
    const value = {
        wabaConfig,
        templates,
        loading,
        error,
        connectWABA,
        updateWABA,
        disconnectWABA,
        testConnection,
        refreshTemplates,
        getTemplate,
        refreshStatus,
        isConnected: (wabaConfig === null || wabaConfig === void 0 ? void 0 : wabaConfig.status) === 'connected',
        hasError: !!error || (wabaConfig === null || wabaConfig === void 0 ? void 0 : wabaConfig.status) === 'error'
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WABAContext.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/lib/contexts/WABAContext.tsx",
        lineNumber: 267,
        columnNumber: 5
    }, this);
}
_s1(WABAProvider, "sWpAuPWb85e9ENrhzWaGmsxVl7o=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = WABAProvider;
var _c;
__turbopack_context__.k.register(_c, "WABAProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/lib/contexts/AgentContext.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "AgentProvider": ()=>AgentProvider,
    "useAgent": ()=>useAgent
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api/client.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
const AgentContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function useAgent() {
    _s();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AgentContext);
    if (context === undefined) {
        throw new Error('useAgent must be used within an AgentProvider');
    }
    return context;
}
_s(useAgent, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
function AgentProvider(param) {
    let { children } = param;
    _s1();
    const [agentConfig, setAgentConfig] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [organizationConfig, setOrganizationConfig] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const { user, isAuthenticated } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    // Load agent configuration when user changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AgentProvider.useEffect": ()=>{
            if (isAuthenticated && user) {
                loadAgentConfig();
            } else {
                setAgentConfig(null);
                setOrganizationConfig(null);
                setLoading(false);
            }
        }
    }["AgentProvider.useEffect"], [
        isAuthenticated,
        user
    ]);
    const loadAgentConfig = async ()=>{
        try {
            setLoading(true);
            setError(null);
            // Load agent configuration
            const agentResponse = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].get("/api/agents/".concat(user === null || user === void 0 ? void 0 : user.id));
            const agentData = agentResponse.data.data;
            setAgentConfig({
                id: agentData.id,
                fullName: agentData.full_name,
                email: agentData.email,
                organizationId: agentData.organization_id,
                wabaPhoneNumber: agentData.waba_phone_number,
                wabaDisplayName: agentData.waba_display_name,
                botName: agentData.bot_name || 'Doro',
                googleConnected: !!agentData.google_email,
                zoomConnected: !!agentData.zoom_user_id,
                wabaConnected: !!agentData.waba_phone_number,
                workingHours: agentData.working_hours || {
                    start: 9,
                    end: 18,
                    days: [
                        1,
                        2,
                        3,
                        4,
                        5
                    ]
                },
                timezone: agentData.timezone || 'Asia/Singapore',
                botPersonalityConfig: agentData.bot_personality_config || {},
                customResponses: agentData.custom_responses || {},
                totalLeads: agentData.total_leads || 0,
                activeConversations: agentData.active_conversations || 0,
                conversionRate: agentData.conversion_rate || 0,
                averageResponseTime: agentData.average_response_time || 0
            });
            // Set organization configuration from agent data (if available)
            if ((user === null || user === void 0 ? void 0 : user.role) === 'admin' && agentData.organization_id) {
                // For now, set basic organization config from agent data
                // In the future, we can add a dedicated organization endpoint if needed
                setOrganizationConfig({
                    id: agentData.organization_id,
                    name: 'Default Organization',
                    slug: 'default',
                    subscriptionTier: 'basic',
                    settings: {},
                    maxAgents: 10,
                    currentAgents: 1,
                    features: []
                });
            }
        } catch (err) {
            console.error('Failed to load agent config:', err);
            setError(err.message || 'Failed to load agent configuration');
        } finally{
            setLoading(false);
        }
    };
    const updateAgentConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AgentProvider.useCallback[updateAgentConfig]": async (updates)=>{
            try {
                setLoading(true);
                setError(null);
                const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].patch("/api/agents/".concat(user === null || user === void 0 ? void 0 : user.id), updates);
                const updatedConfig = response.data.data;
                setAgentConfig({
                    "AgentProvider.useCallback[updateAgentConfig]": (prev)=>prev ? {
                            ...prev,
                            ...updatedConfig
                        } : null
                }["AgentProvider.useCallback[updateAgentConfig]"]);
            } catch (err) {
                setError(err.message || 'Failed to update agent configuration');
                throw err;
            } finally{
                setLoading(false);
            }
        }
    }["AgentProvider.useCallback[updateAgentConfig]"], [
        user === null || user === void 0 ? void 0 : user.id
    ]);
    const refreshAgentConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AgentProvider.useCallback[refreshAgentConfig]": async ()=>{
            await loadAgentConfig();
        }
    }["AgentProvider.useCallback[refreshAgentConfig]"], []);
    const updateBotPersonality = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AgentProvider.useCallback[updateBotPersonality]": async (config)=>{
            await updateAgentConfig({
                botPersonalityConfig: config
            });
        }
    }["AgentProvider.useCallback[updateBotPersonality]"], [
        updateAgentConfig
    ]);
    const updateCustomResponses = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AgentProvider.useCallback[updateCustomResponses]": async (responses)=>{
            await updateAgentConfig({
                customResponses: responses
            });
        }
    }["AgentProvider.useCallback[updateCustomResponses]"], [
        updateAgentConfig
    ]);
    const updateWorkingHours = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AgentProvider.useCallback[updateWorkingHours]": async (hours)=>{
            await updateAgentConfig({
                workingHours: hours
            });
        }
    }["AgentProvider.useCallback[updateWorkingHours]"], [
        updateAgentConfig
    ]);
    const isWithinWorkingHours = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AgentProvider.useCallback[isWithinWorkingHours]": function() {
            let date = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : new Date();
            if (!agentConfig) return false;
            const { workingHours, timezone } = agentConfig;
            // Convert to agent's timezone
            const agentTime = new Date(date.toLocaleString('en-US', {
                timeZone: timezone
            }));
            const dayOfWeek = agentTime.getDay();
            const hour = agentTime.getHours();
            return workingHours.days.includes(dayOfWeek) && hour >= workingHours.start && hour < workingHours.end;
        }
    }["AgentProvider.useCallback[isWithinWorkingHours]"], [
        agentConfig
    ]);
    const getNextAvailableSlot = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AgentProvider.useCallback[getNextAvailableSlot]": ()=>{
            if (!agentConfig) return null;
            const { workingHours, timezone } = agentConfig;
            const now = new Date();
            // Find next available slot within the next 7 days
            for(let i = 0; i < 7; i++){
                const checkDate = new Date(now);
                checkDate.setDate(now.getDate() + i);
                const agentTime = new Date(checkDate.toLocaleString('en-US', {
                    timeZone: timezone
                }));
                const dayOfWeek = agentTime.getDay();
                if (workingHours.days.includes(dayOfWeek)) {
                    agentTime.setHours(workingHours.start, 0, 0, 0);
                    // If it's today and we're past start time, use current time + 1 hour
                    if (i === 0 && now.getHours() >= workingHours.start) {
                        agentTime.setTime(now.getTime() + 60 * 60 * 1000); // Add 1 hour
                    }
                    // Make sure it's within working hours
                    if (agentTime.getHours() < workingHours.end) {
                        return agentTime;
                    }
                }
            }
            return null;
        }
    }["AgentProvider.useCallback[getNextAvailableSlot]"], [
        agentConfig
    ]);
    const canCreateNewConversation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AgentProvider.useCallback[canCreateNewConversation]": ()=>{
            if (!agentConfig || !organizationConfig) return false;
            // Check subscription limits
            const maxConversations = organizationConfig.subscriptionTier === 'basic' ? 50 : organizationConfig.subscriptionTier === 'pro' ? 200 : 1000;
            return agentConfig.activeConversations < maxConversations;
        }
    }["AgentProvider.useCallback[canCreateNewConversation]"], [
        agentConfig,
        organizationConfig
    ]);
    const value = {
        agentConfig,
        organizationConfig,
        loading,
        error,
        updateAgentConfig,
        refreshAgentConfig,
        updateBotPersonality,
        updateCustomResponses,
        updateWorkingHours,
        isWithinWorkingHours,
        getNextAvailableSlot,
        canCreateNewConversation
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AgentContext.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/lib/contexts/AgentContext.tsx",
        lineNumber: 281,
        columnNumber: 5
    }, this);
}
_s1(AgentProvider, "pjdRvDyvwqGwZDDIqYkMz1ZDY14=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = AgentProvider;
var _c;
__turbopack_context__.k.register(_c, "AgentProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/app/providers.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "Providers": ()=>Providers,
    "useTheme": ()=>useTheme
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$socket$2f$SocketContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/socket/SocketContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$contexts$2f$WABAContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/contexts/WABAContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$contexts$2f$AgentContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/contexts/AgentContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$queryClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/query-core/build/modern/queryClient.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2d$devtools$2f$build$2f$modern$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query-devtools/build/modern/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-themes/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-tooltip/dist/index.mjs [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
;
// Create a client with modern React Query v5 configuration
const queryClient = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$queryClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["QueryClient"]({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: (failureCount, error)=>{
                // Don't retry on 401/403 errors
                if ((error === null || error === void 0 ? void 0 : error.status) === 401 || (error === null || error === void 0 ? void 0 : error.status) === 403) {
                    return false;
                }
                return failureCount < 3;
            },
            refetchOnWindowFocus: false,
            refetchOnReconnect: 'always'
        },
        mutations: {
            retry: 1
        }
    }
});
const ThemeContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function useTheme() {
    _s();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
_s(useTheme, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
function ThemeProvider(param) {
    let { children } = param;
    _s1();
    const [theme, setTheme] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('light');
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeProvider.useEffect": ()=>{
            setMounted(true);
            // Check for saved theme preference or default to light
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                setTheme(savedTheme);
            } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                setTheme('dark');
            }
        }
    }["ThemeProvider.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeProvider.useEffect": ()=>{
            if (!mounted) return;
            localStorage.setItem('theme', theme);
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }["ThemeProvider.useEffect"], [
        theme,
        mounted
    ]);
    const toggleTheme = ()=>{
        setTheme((prev)=>prev === 'light' ? 'dark' : 'light');
    };
    // Prevent hydration mismatch by not rendering until mounted
    if (!mounted) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            style: {
                visibility: 'hidden'
            },
            children: children
        }, void 0, false, {
            fileName: "[project]/app/providers.tsx",
            lineNumber: 83,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ThemeContext.Provider, {
        value: {
            theme,
            toggleTheme
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/app/providers.tsx",
        lineNumber: 87,
        columnNumber: 5
    }, this);
}
_s1(ThemeProvider, "irO646EbSVqPL90dedilwyEs6oc=");
_c = ThemeProvider;
function Providers(param) {
    let { children } = param;
    _s2();
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Providers.useEffect": ()=>{
            setMounted(true);
        }
    }["Providers.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["QueryClientProvider"], {
        client: queryClient,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ThemeProvider"], {
            attribute: "class",
            defaultTheme: "light",
            enableSystem: true,
            disableTransitionOnChange: true,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipProvider"], {
                delayDuration: 300,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AuthProvider"], {
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$contexts$2f$AgentContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AgentProvider"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$contexts$2f$WABAContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WABAProvider"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$socket$2f$SocketContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SocketProvider"], {
                                children: [
                                    children,
                                    mounted && ("TURBOPACK compile-time value", "development") === 'development' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2d$devtools$2f$build$2f$modern$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ReactQueryDevtools"], {
                                        initialIsOpen: false,
                                        buttonPosition: "bottom-left",
                                        position: "bottom"
                                    }, void 0, false, {
                                        fileName: "[project]/app/providers.tsx",
                                        lineNumber: 128,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/providers.tsx",
                                lineNumber: 125,
                                columnNumber: 17
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/providers.tsx",
                            lineNumber: 124,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/providers.tsx",
                        lineNumber: 123,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/providers.tsx",
                    lineNumber: 122,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/providers.tsx",
                lineNumber: 121,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/providers.tsx",
            lineNumber: 115,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/providers.tsx",
        lineNumber: 114,
        columnNumber: 5
    }, this);
}
_s2(Providers, "LrrVfNW3d1raFE0BNzCTILYmIfo=");
_c1 = Providers;
var _c, _c1;
__turbopack_context__.k.register(_c, "ThemeProvider");
__turbopack_context__.k.register(_c1, "Providers");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/lib/utils.ts [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "camelToKebab": ()=>camelToKebab,
    "capitalize": ()=>capitalize,
    "cn": ()=>cn,
    "debounce": ()=>debounce,
    "deepClone": ()=>deepClone,
    "formatCurrency": ()=>formatCurrency,
    "formatNumber": ()=>formatNumber,
    "formatPercentage": ()=>formatPercentage,
    "generateId": ()=>generateId,
    "getInitials": ()=>getInitials,
    "getNestedProperty": ()=>getNestedProperty,
    "groupBy": ()=>groupBy,
    "isClient": ()=>isClient,
    "isDevelopment": ()=>isDevelopment,
    "isEmpty": ()=>isEmpty,
    "isProduction": ()=>isProduction,
    "isServer": ()=>isServer,
    "kebabToCamel": ()=>kebabToCamel,
    "removeDuplicates": ()=>removeDuplicates,
    "setNestedProperty": ()=>setNestedProperty,
    "sleep": ()=>sleep,
    "sortBy": ()=>sortBy,
    "throttle": ()=>throttle,
    "truncateText": ()=>truncateText
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-client] (ecmascript)");
;
;
function cn() {
    for(var _len = arguments.length, inputs = new Array(_len), _key = 0; _key < _len; _key++){
        inputs[_key] = arguments[_key];
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
function formatCurrency(amount) {
    let currency = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'SGD', locale = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 'en-SG';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}
function formatNumber(num) {
    let locale = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'en-SG';
    return new Intl.NumberFormat(locale).format(num);
}
function formatPercentage(value) {
    let decimals = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1;
    return "".concat(value.toFixed(decimals), "%");
}
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
}
function getInitials(name) {
    return name.split(' ').map((word)=>word.charAt(0)).join('').toUpperCase().slice(0, 2);
}
function debounce(func, wait) {
    let timeout = null;
    return function() {
        for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
            args[_key] = arguments[_key];
        }
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(()=>func(...args), wait);
    };
}
function throttle(func, limit) {
    let inThrottle = false;
    return function() {
        for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
            args[_key] = arguments[_key];
        }
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(()=>inThrottle = false, limit);
        }
    };
}
function sleep(ms) {
    return new Promise((resolve)=>setTimeout(resolve, ms));
}
function generateId() {
    let length = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 8;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for(let i = 0; i < length; i++){
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
function isEmpty(value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0;
    return false;
}
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map((item)=>deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for(const key in obj){
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
    return obj;
}
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
function camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}
function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (_, letter)=>letter.toUpperCase());
}
function getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key)=>{
        if (current && typeof current === 'object' && key in current) {
            return current[key];
        }
        return undefined;
    }, obj);
}
function setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key)=>{
        if (!(key in current)) current[key] = {};
        return current[key];
    }, obj);
    target[lastKey] = value;
}
function removeDuplicates(array, key) {
    if (!key) {
        return [
            ...new Set(array)
        ];
    }
    const seen = new Set();
    return array.filter((item)=>{
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
}
function groupBy(array, key) {
    return array.reduce((groups, item)=>{
        const group = String(item[key]);
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
    }, {});
}
function sortBy(array) {
    for(var _len = arguments.length, criteria = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
        criteria[_key - 1] = arguments[_key];
    }
    return [
        ...array
    ].sort((a, b)=>{
        for (const criterion of criteria){
            let aVal, bVal;
            if (typeof criterion === 'function') {
                aVal = criterion(a);
                bVal = criterion(b);
            } else {
                aVal = a[criterion];
                bVal = b[criterion];
            }
            // Type-safe comparison
            if (aVal == null && bVal != null) return -1;
            if (aVal != null && bVal == null) return 1;
            if (aVal == null && bVal == null) return 0;
            // Compare primitive values
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const comp = aVal.localeCompare(bVal);
                if (comp !== 0) return comp;
            } else if (typeof aVal === 'number' && typeof bVal === 'number') {
                if (aVal < bVal) return -1;
                if (aVal > bVal) return 1;
            } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
                if (aVal < bVal) return -1;
                if (aVal > bVal) return 1;
            }
        }
        return 0;
    });
}
const isDevelopment = ("TURBOPACK compile-time value", "development") === 'development';
const isProduction = ("TURBOPACK compile-time value", "development") === 'production';
const isClient = "object" !== 'undefined';
const isServer = "object" === 'undefined';
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/components/ui/button.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "Button": ()=>Button,
    "buttonVariants": ()=>buttonVariants
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-slot/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/class-variance-authority/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
;
;
;
;
const buttonVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0', {
    variants: {
        variant: {
            default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
            destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
            outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
            secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
            ghost: 'hover:bg-accent hover:text-accent-foreground',
            link: 'text-primary underline-offset-4 hover:underline'
        },
        size: {
            default: 'h-9 px-4 py-2',
            sm: 'h-8 rounded-md px-3 text-xs',
            lg: 'h-10 rounded-md px-8',
            icon: 'h-9 w-9'
        }
    },
    defaultVariants: {
        variant: 'default',
        size: 'default'
    }
});
const Button = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c = (param, ref)=>{
    let { className, variant, size, asChild = false, ...props } = param;
    const Comp = asChild ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Slot"] : 'button';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Comp, {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(buttonVariants({
            variant,
            size,
            className
        })),
        ref: ref,
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/button.tsx",
        lineNumber: 46,
        columnNumber: 7
    }, ("TURBOPACK compile-time value", void 0));
});
_c1 = Button;
Button.displayName = 'Button';
;
var _c, _c1;
__turbopack_context__.k.register(_c, "Button$React.forwardRef");
__turbopack_context__.k.register(_c1, "Button");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/components/ui/card.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "Card": ()=>Card,
    "CardContent": ()=>CardContent,
    "CardDescription": ()=>CardDescription,
    "CardFooter": ()=>CardFooter,
    "CardHeader": ()=>CardHeader,
    "CardTitle": ()=>CardTitle
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
;
;
const Card = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c = (param, ref)=>{
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('rounded-xl border bg-card text-card-foreground shadow', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/card.tsx",
        lineNumber: 8,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
});
_c1 = Card;
Card.displayName = 'Card';
const CardHeader = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c2 = (param, ref)=>{
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex flex-col space-y-1.5 p-6', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/card.tsx",
        lineNumber: 23,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
});
_c3 = CardHeader;
CardHeader.displayName = 'CardHeader';
const CardTitle = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c4 = (param, ref)=>{
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('font-semibold leading-none tracking-tight', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/card.tsx",
        lineNumber: 31,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
});
_c5 = CardTitle;
CardTitle.displayName = 'CardTitle';
const CardDescription = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c6 = (param, ref)=>{
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('text-sm text-muted-foreground', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/card.tsx",
        lineNumber: 43,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
});
_c7 = CardDescription;
CardDescription.displayName = 'CardDescription';
const CardContent = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c8 = (param, ref)=>{
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('p-6 pt-0', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/card.tsx",
        lineNumber: 55,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
});
_c9 = CardContent;
CardContent.displayName = 'CardContent';
const CardFooter = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c10 = (param, ref)=>{
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex items-center p-6 pt-0', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/card.tsx",
        lineNumber: 63,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
});
_c11 = CardFooter;
CardFooter.displayName = 'CardFooter';
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11;
__turbopack_context__.k.register(_c, "Card$React.forwardRef");
__turbopack_context__.k.register(_c1, "Card");
__turbopack_context__.k.register(_c2, "CardHeader$React.forwardRef");
__turbopack_context__.k.register(_c3, "CardHeader");
__turbopack_context__.k.register(_c4, "CardTitle$React.forwardRef");
__turbopack_context__.k.register(_c5, "CardTitle");
__turbopack_context__.k.register(_c6, "CardDescription$React.forwardRef");
__turbopack_context__.k.register(_c7, "CardDescription");
__turbopack_context__.k.register(_c8, "CardContent$React.forwardRef");
__turbopack_context__.k.register(_c9, "CardContent");
__turbopack_context__.k.register(_c10, "CardFooter$React.forwardRef");
__turbopack_context__.k.register(_c11, "CardFooter");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/components/error-boundary.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "ErrorBoundary": ()=>ErrorBoundary,
    "useErrorHandler": ()=>useErrorHandler,
    "withErrorBoundary": ()=>withErrorBoundary
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.js [app-client] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/refresh-cw.js [app-client] (ecmascript) <export default as RefreshCw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/card.tsx [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
const DefaultErrorFallback = (param)=>{
    let { error, resetError } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex items-center justify-center p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
            className: "w-full max-w-md",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardHeader"], {
                    className: "text-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                                className: "h-6 w-6 text-destructive"
                            }, void 0, false, {
                                fileName: "[project]/components/error-boundary.tsx",
                                lineNumber: 31,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/components/error-boundary.tsx",
                            lineNumber: 30,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardTitle"], {
                            className: "text-xl",
                            children: "Something went wrong"
                        }, void 0, false, {
                            fileName: "[project]/components/error-boundary.tsx",
                            lineNumber: 33,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardDescription"], {
                            children: "An unexpected error occurred. Please try refreshing the page."
                        }, void 0, false, {
                            fileName: "[project]/components/error-boundary.tsx",
                            lineNumber: 34,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/error-boundary.tsx",
                    lineNumber: 29,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                    className: "space-y-4",
                    children: [
                        ("TURBOPACK compile-time value", "development") === 'development' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                            className: "text-sm",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                    className: "cursor-pointer font-medium text-muted-foreground hover:text-foreground",
                                    children: "Error details"
                                }, void 0, false, {
                                    fileName: "[project]/components/error-boundary.tsx",
                                    lineNumber: 41,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                                    className: "mt-2 whitespace-pre-wrap break-words text-xs bg-muted p-3 rounded-md overflow-auto max-h-32",
                                    children: [
                                        error.message,
                                        error.stack && "\n\n".concat(error.stack)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/error-boundary.tsx",
                                    lineNumber: 44,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/error-boundary.tsx",
                            lineNumber: 40,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    onClick: resetError,
                                    className: "flex-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                            className: "mr-2 h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/components/error-boundary.tsx",
                                            lineNumber: 52,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        "Try again"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/error-boundary.tsx",
                                    lineNumber: 51,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    variant: "outline",
                                    onClick: ()=>window.location.reload(),
                                    className: "flex-1",
                                    children: "Reload page"
                                }, void 0, false, {
                                    fileName: "[project]/components/error-boundary.tsx",
                                    lineNumber: 55,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/error-boundary.tsx",
                            lineNumber: 50,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/error-boundary.tsx",
                    lineNumber: 38,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/components/error-boundary.tsx",
            lineNumber: 28,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/components/error-boundary.tsx",
        lineNumber: 27,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = DefaultErrorFallback;
class ErrorBoundary extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Component {
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error
        };
    }
    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        // Log to error reporting service
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
        this.setState({
            error,
            errorInfo
        });
    }
    render() {
        if (this.state.hasError && this.state.error) {
            const FallbackComponent = this.props.fallback || DefaultErrorFallback;
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FallbackComponent, {
                error: this.state.error,
                resetError: this.resetError
            }, void 0, false, {
                fileName: "[project]/components/error-boundary.tsx",
                lineNumber: 103,
                columnNumber: 14
            }, this);
        }
        return this.props.children;
    }
    constructor(props){
        super(props), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "resetError", ()=>{
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null
            });
        });
        this.state = {
            hasError: false
        };
    }
}
function useErrorHandler() {
    return (error, errorInfo)=>{
        console.error('Error caught by useErrorHandler:', error, errorInfo);
        // In a real app, you would send this to your error reporting service
        if (("TURBOPACK compile-time value", "development") === 'production') {
        // Example: Sentry.captureException(error, { extra: errorInfo })
        }
    };
}
function withErrorBoundary(Component, errorBoundaryProps) {
    const WrappedComponent = (props)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ErrorBoundary, {
            ...errorBoundaryProps,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Component, {
                ...props
            }, void 0, false, {
                fileName: "[project]/components/error-boundary.tsx",
                lineNumber: 129,
                columnNumber: 7
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/error-boundary.tsx",
            lineNumber: 128,
            columnNumber: 5
        }, this);
    WrappedComponent.displayName = "withErrorBoundary(".concat(Component.displayName || Component.name, ")");
    return WrappedComponent;
}
var _c;
__turbopack_context__.k.register(_c, "DefaultErrorFallback");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
}]);

//# sourceMappingURL=_1b44a163._.js.map