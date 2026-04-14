// Event Constants organized by category

export const EVENT_CATEGORIES = {
    UserActions: {
        LOGIN: 'user_login',
        LOGOUT: 'user_logout',
        SIGNUP: 'user_signup',
    },
    PageViews: {
        HOME: 'page_view_home',
        DASHBOARD: 'page_view_dashboard',
        PROFILE: 'page_view_profile',
    },
    Errors: {
        SERVER_ERROR: 'error_server',
        CLIENT_ERROR: 'error_client',
    }
};

export const EVENT_SCHEMAS = {
    UserActions: {
        LOGIN: { username: 'string', timestamp: 'date' },
        LOGOUT: { username: 'string', timestamp: 'date' },
        SIGNUP: { username: 'string', email: 'string', timestamp: 'date' },
    },
    PageViews: {
        HOME: { timestamp: 'date' },
        DASHBOARD: { timestamp: 'date', userId: 'string' },
        PROFILE: { timestamp: 'date', userId: 'string' },
    },
    Errors: {
        SERVER_ERROR: { message: 'string', code: 'number', timestamp: 'date' },
        CLIENT_ERROR: { message: 'string', code: 'number', timestamp: 'date' },
    }
};