
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        const userRole = req.session?.user?.userrole; // Get user role from session
        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).render('403', {
                title: 'Access Denied',
                message: 'You do not have permission to access this page.',
                user: req.session?.user || null, // Pass user data if available
            });
        }
        next();
    };
}

module.exports = authorizeRoles;
