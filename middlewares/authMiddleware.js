module.exports = (req, res, next) => {
    //Login disabled
    // req.session.user = {
    //     id: 1,
    //     name: 'User 1',
    //     username: 'user1',
    //     userimg: '',
    //     sidemenu: ''
    // };
    // return next();
    if (req.session.user) {
        return next(); // User is authenticated, proceed to the next middleware/controller
    }
    res.redirect('/login'); // Redirect to login if not authenticated
};