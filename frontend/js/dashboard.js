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

        const quickBookBtn = document.getElementById('quick-book-btn');
        if (quickBookBtn) {
            quickBookBtn.addEventListener('click', () => {
                console.log('Quick Book button clicked');
                alert('Quick booking is coming soon.');
            });
        }

    } catch (error) {
        console.error('Dashboard authentication error:', error);
        window.location.href = '/login.html';
    }
})();