// Rate limiter with multiple layers for backpressure

// Layer 1: Message rate limiting (per user, per minute)
const MESSAGE_RATE_LIMIT = 50;
const MESSAGE_RATE_WINDOW = 60000;

// Layer 2: Event rate tracking (events per second per user)
const EVENT_RATE_LIMIT = 100;
const EVENT_RATE_WINDOW = 1000;

// Layer 3: Server load threshold
const SERVER_LOAD_THRESHOLD = 0.7;

const userMessageRates = new Map();
const userEventRates = new Map();
const messageQueue = [];
let serverLoad = 0;

export const checkMessageRate = (userId) => {
    const now = Date.now();
    
    if (!userMessageRates.has(userId)) {
        userMessageRates.set(userId, {
            count: 0,
            resetAt: now + MESSAGE_RATE_WINDOW,
            recentTimestamps: []
        });
    }
    
    const rateData = userMessageRates.get(userId);
    
    if (now > rateData.resetAt) {
        rateData.count = 0;
        rateData.resetAt = now + MESSAGE_RATE_WINDOW;
        rateData.recentTimestamps = [];
    }
    
    rateData.recentTimestamps = rateData.recentTimestamps.filter(ts => now - ts < MESSAGE_RATE_WINDOW);
    
    if (rateData.count >= MESSAGE_RATE_LIMIT) {
        return {
            allowed: false,
            retryAfter: Math.ceil((rateData.resetAt - now) / 1000)
        };
    }
    
    rateData.count++;
    rateData.recentTimestamps.push(now);
    
    return { allowed: true };
};

export const checkEventRate = (userId) => {
    const now = Date.now();
    
    if (!userEventRates.has(userId)) {
        userEventRates.set(userId, { count: 0, resetAt: now + EVENT_RATE_WINDOW });
    }
    
    const rateData = userEventRates.get(userId);
    
    if (now > rateData.resetAt) {
        rateData.count = 0;
        rateData.resetAt = now + EVENT_RATE_WINDOW;
    }
    
    if (rateData.count >= EVENT_RATE_LIMIT) {
        return { allowed: false };
    }
    
    rateData.count++;
    return { allowed: true };
};

export const checkServerLoad = () => {
    const queueSize = messageQueue.length;
    const bufferSize = 50;
    
    if (queueSize === 0) {
        serverLoad = 0;
        return { allowed: true, load: 0 };
    }
    
    serverLoad = Math.min(queueSize / bufferSize, 1);
    
    return {
        allowed: serverLoad < SERVER_LOAD_THRESHOLD,
        load: serverLoad
    };
};

export const queueMessage = (message) => {
    if (messageQueue.length >= 50) {
        return false;
    }
    messageQueue.push(message);
    return true;
};

export const dequeueMessage = () => {
    return messageQueue.shift();
};

export const getQueuedMessages = () => {
    return [...messageQueue];
};

export const getRateLimitStatus = (userId) => {
    const now = Date.now();
    const rateData = userMessageRates.get(userId);
    
    if (!rateData) {
        return { current: 0, limit: MESSAGE_RATE_LIMIT };
    }
    
    if (now > rateData.resetAt) {
        return { current: 0, limit: MESSAGE_RATE_LIMIT };
    }
    
    return {
        current: rateData.count,
        limit: MESSAGE_RATE_LIMIT,
        resetIn: Math.ceil((rateData.resetAt - now) / 1000)
    };
};

export default checkMessageRate;