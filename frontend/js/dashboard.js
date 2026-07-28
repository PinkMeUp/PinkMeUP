if (!requireAuth()) {
    // Redirect happens inside requireAuth()
}

const user = getCurrentUser();
if (user) {
    console.log('Welcome, ' + user.firstName + ' ' + user.lastName);
}