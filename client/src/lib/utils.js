export function formatMessageTime(date){
    return new Date(date).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })
}

export function formatFullDateTime(date){
    return new Date(date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    })
}

export function formatMessageDate(date) {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
        return "Today";
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
    } else {
        return messageDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: messageDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined
        });
    }
}

export function formatLastSeen(lastSeen) {
    if (!lastSeen) return "Offline";
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "last seen just now";
    if (diffMins < 60) return `last seen ${diffMins}m ago`;
    if (diffHours < 24) return `last seen ${diffHours}h ago`;
    if (diffDays < 7) return `last seen ${diffDays}d ago`;
    
    return `last seen ${date.toLocaleDateString()}`;
}

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236b7280'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

export function getAvatarUrl(profilePic) {
    if (!profilePic || profilePic === "") {
        return DEFAULT_AVATAR;
    }
    return profilePic;
}