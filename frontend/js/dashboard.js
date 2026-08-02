/**
 * Dashboard page authentication handler
 * Syncs Google OAuth users and protects dashboard access
 */

(async () => {
    try {
        // Sync authentication from backend cookie (Google OAuth)
        const synced = await syncAuthFromServer();

        // If backend sync failed, check local authentication
        if (!synced && !isAuthenticated()) {
            window.location.href = '/login.html';
            return;
        }

        // Get current logged-in user
        const user = getCurrentUser();

        if (user) {
            console.log(
                'Welcome, ' + user.firstName + ' ' + user.lastName
            );
        }

    } catch (error) {
        console.error('Dashboard authentication error:', error);
        window.location.href = '/login.html';
    }
})();