(async () => {
    await syncAuthFromServer();

    if (!requireAuth()) {
        return;
    }

    const user = getCurrentUser();

    if (user) {
        console.log('Welcome, ' + user.firstName + ' ' + user.lastName);
    }
})();