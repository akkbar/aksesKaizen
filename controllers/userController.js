const bcrypt = require('bcrypt');
const mainModel = require('../models/mainModel');
const mainValidator = require('../middlewares/mainValidate');
const logError = require('../middlewares/errorlogger')

//==========================================================================================================================
//==========================================================================================================================
//MANAGE SELF ACCOUNT
//==========================================================================================================================
//==========================================================================================================================
exports.myUsers = async (req, res) => {
    try {
        const header = {pageTitle: 'Account Setting', user: req.session.user}
        const user = await mainModel.getUserData(req.session.user.username);
        if (user) {
            res.render('users/userset', { header: header, userdata: user});
        }else{
            res.render('500', { header: header, message: 'Invalid userdata, please re-login.' });
        }
    }catch (error) {
        console.error(error)
        await logError('error', error.message, error.stack, { functionName: 'userController/myUsers' })
        return res.json({ success: false, message: 'Server error, please try again later'});
    }
}
exports.changePass = async (req, res) => {
    const { oldpassword, password, repassword } = req.body;
    const errors = {};

    const isValidPassword = (password) =>
        password.length >= 8 && /(?=.*[A-Z])(?=.*\W)(?=.*\d)/.test(password);

    
    if (!oldpassword) {
        errors.oldpassword = 'Please type your current password.';
    }
    if (!password) {
        errors.password = 'New Password is required.';
    } else if (!isValidPassword(password)) {
        errors.password =
            'Password must be at least 8 characters, include 1 uppercase letter, 1 number, and 1 symbol.';
    }
    if (password !== repassword) {
        errors.repassword = 'Passwords do not match.';
    }
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }
    try {
        const username = req.session.user.username
        const user = await mainModel.getUserData(req.session.user.username);
        if (!user) {
            return res.json({ success: false, message: 'Invalid data'});
        }

        const isValidPassword = await bcrypt.compare(oldpassword, user.password);
        if (!isValidPassword) {
            errors.oldpassword = 'Invalid old password.'
            return res.json({ success: false, errors});
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const data = {
            password: hashedPassword
        }
        const result = await mainModel.editUserData(username, data)

        return res.json({ success: true, message: result});

    }catch (error) {
        console.error(error)
        await logError('error', error.message, error.stack, { functionName: 'userController/changePass' })
        return res.json({ success: false, message: 'Server error, please try again later'});
    }
}


exports.sidemenu = async (req, res) => {
    if(req.session.user.sidemenu == ''){
        req.session.user.sidemenu = 'sidebar-collapse'
    }else{
        req.session.user.sidemenu = ''
    }
    return res.json({ success: true});

};

exports.updateProfile = async (req, res) => {
    const { fullname, oldPassword } = req.body;
    try{
        if (!fullname || !oldPassword) {
            return res.json({ success: false, message: 'All fields are required.' });
        }

        const user = await mainModel.getUserData(req.session.user.username);
        if (!user) {
            return res.json({ success: false, message: 'Invalid data'});
        }

        const isValidPassword = await bcrypt.compare(oldPassword, user.password);
        if (!isValidPassword) {
            errors.oldpassword = 'Invalid old password.'
            return res.json({ success: false, errors});
        }
        const data = {
            fullname: fullname
        }
        const result = await mainModel.editUserData(req.session.user.username, data)
        if(result){
            req.session.user.name = fullname
            return res.json({ success: true, message: 'Profile updated successfully.' });
        }else{
            return res.json({ success: false, message: 'Failed.' });
        }
    } catch(error) {
        console.error(error)
    }
    
};
//==========================================================================================================================
//==========================================================================================================================
//MANAGE ALL ACCOUNT
//==========================================================================================================================
//==========================================================================================================================
exports.userList = (req, res) => {
    const header = {pageTitle: 'User List', user: req.session.user}
    res.render('users/userlist', {header: header})
}

exports.userListAjax = async (req, res) => {
    const filters = {
        draw: req.body.draw,
        start: req.body.start,
        length: req.body.length,
        search_value: req.body.search['value'],
        order: req.body.order || []
    };
    const columnNames = [
        'fullname',
        'user_role',
        'last_login',
        null
    ];
    const columnSearches = req.body.columns.map((col, index) => {
        if (col.search.value && col.orderable) {
            return { column: columnNames[index], value: col.search.value }
        }
        return null
    }).filter(col => col)

    try {
        const orderColumnIndex = filters.order.length > 0 ? filters.order[0].column : null
        const orderDirection = filters.order.length > 0 ? filters.order[0].dir : 'asc'
        
        const orderColumn = orderColumnIndex !== null ? columnNames[orderColumnIndex] : 'fullname'
        
        const data = await mainModel.userList(filters, orderColumn, orderDirection, columnSearches)

        const recordsFiltered = await mainModel.userListFiltered(filters, columnSearches)

        const output = {
            draw: filters.draw,
            recordsTotal: await mainModel.userListCountAll(),
            recordsFiltered,
            data: data.map(record => {
                return [
                    record.fullname,
                    record.user_role,
                    record.last_login,
                    `<button class="btn btn-sm btn-primary" onclick="show_modal('${record.id}')"><i class="fa fa-pencil-alt"></i> Edit</button>
                    ${
                        record.user_role !== 'Admin' 
                            ? `<button class="btn btn-sm btn-danger" onclick="delete_modal('${record.id}')">
                                   <i class="fa fa-trash-alt"></i> Delete
                               </button>`
                            : ''
                    }`
                ];
            })
        };

        res.json(output)
    } catch (error) {
        console.error(error)
        await logError('error', error.message, error.stack, { functionName: 'userController/userListAjax' })
        res.status(500).json({ error: 'An error occurred while fetching the data' })
    }
}

exports.createProfile = async (req, res) => {
    try {
        const userData = req.body
        const { error } = mainValidator.joiUserData(userData)
        if (error) {
            return res.status(400).json({ message: error.details[0].message })
        }

        const sanitizedData = mainValidator.sanitizeUserData(userData)

        const user = await mainModel.getUserData(sanitizedData.username)
        if (user) {
            res.status(500).json({ message: 'Username already exists.' })
        }
        const hashedPassword = await bcrypt.hash('Barka123654', 10)
        const data = {
            username: sanitizedData.username,
            fullname: sanitizedData.fullname,
            user_role: sanitizedData.user_role,
            password: hashedPassword,
        }
        await mainModel.addUserData(data)
        res.status(201).json({ message: 'Data added successfully' })
    } catch (error) {
        console.error(error)
        await logError('error', error.message, error.stack, { functionName: 'userController/createProfile' })
        res.status(500).json({ message: error.message })
    }
}

exports.getProfile = async (req, res) => {
    try {
        const id = req.body.editId
        const data = await mainModel.getUserDataById(id)
        res.status(201).json({ message: 'data read successfully', data: data })
    } catch (error) {
        console.error(error)
        await logError('error', error.message, error.stack, { functionName: 'userController/getProfile' })
        res.status(500).json({ message: error.message })
    }
};

exports.updateUser = async (req, res) => {
    try {
        const userData = {user_role: req.body.user_role}
        const isReset = req.body.isreset
        const { error } = mainValidator.joiUserRole(userData)
        if (error) {
            return res.status(400).json({ message: error.details[0].message })
        }
        let data = []
        if(isReset == 1){
            const hashedPassword = await bcrypt.hash('Barka123654', 10)
            data = {
                user_role: userData.user_role,
                password: hashedPassword,
            }
        }else{
            data = {
                user_role: userData.user_role,
            }
        }
        await mainModel.editUserDataById(req.body.editId, data)
        res.status(201).json({ message: 'Data edited successfully'})
    } catch (error) {
        console.error(error)
        await logError('error', error.message, error.stack, { functionName: 'userController/updateUser' })
        res.status(500).json({ message: error.message })
    }
};
exports.removeUser = async (req, res) => {
    try {
        const data = {isactive: 0,}
        await mainModel.editUserDataById(req.body.id, data)
        res.status(201).json({ message: 'Data deleted successfully'})
    } catch (error) {
        console.error(error)
        await logError('error', error.message, error.stack, { functionName: 'userController/removeUser' })
        res.status(500).json({ message: error.message })
    }
}



