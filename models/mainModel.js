const mainDb = require('../models/mainDb');


class mainModel {
    //===================================================================================================================================
    //===================================================================================================================================
    //MACHINE GROUPING CATEGORY
    //===================================================================================================================================
    //===================================================================================================================================
    // async addMachineGroup(data) {
    //     try {
    //         await cncDb.transaction(async trx => {
    //             await trx('machine_group').insert(data);
    //         });
    //         return true;
    //     } catch (err) {
    //         return 'Error adding machine group:' + err;
    //     }
    // }
    // async editMachineGroup(id, data) {
    //     try {
    //         await cncDb.transaction(async trx => {
    //             const updatedRows = await trx('machine_group')
    //                 .where('id', id)
    //                 .update(data);
    
    //             if (updatedRows === 0) {
    //                 return 'No machine group found with the given ID';
    //             }
    //         });
    //         return true;
    //     } catch (err) {
    //         return 'Error editing machine group: ' + err.message;
    //     }
    // }    
    // async deleteMachineGroup(id) {
    //     try {
    //         await cncDb.transaction(async trx => {
    //             const deletedRows = await trx('machine_group')
    //                 .where('id', id)
    //                 .del();
    //             if (deletedRows === 0) {
    //                 return 'No machine group found with the given ID';
    //             }
    //         });
    //         return true;
    //     } catch (err) {
    //         return 'Error deleting machine group: ' + err.message;
    //     }
    // }
    // async getMachineGroup() {
    //     try {
    //         const machineGroups = await cncDb('machine_group').select('*');
    //         return machineGroups;
    //     } catch (err) {
    //         console.error('Error fetching machine groups:', err);
    //         throw new Error('Failed to fetch machine groups');
    //     }
    // }
    
    
    //===================================================================================================================================
    //===================================================================================================================================
    //MANAGE USERS
    //===================================================================================================================================
    //===================================================================================================================================
    async addUserData(data) {
        try {
            await mainDb.transaction(async trx => {
                await trx('users').insert(data);
            });
            return true;
        } catch (err) {
            return 'Error adding data:' + err;
        }
    }
    async getUserData(username) {
        try {
            const data = await mainDb('users').select('*').where({ 'username': username, 'isactive': 1 }).first();
            return data;
        } catch (err) {
            console.error('Error fetching data', err);
            throw new Error('Failed to fetch ');
        }
    }
    async getUserDataById(id) {
        try {
            const data = await mainDb('users').select('*').where({ 'id': id, 'isactive': 1 }).first();
            return data;
        } catch (err) {
            console.error('Error fetching data', err);
            throw new Error('Failed to fetch ');
        }
    }
    async editUserData(username, data) {
        try {
            await mainDb.transaction(async trx => {
                const updatedRows = await trx('users')
                    .where('username', username)
                    .update(data);
    
                if (updatedRows === 0) {
                    return 'No data found with the given username';
                }
            });
            return true;
        } catch (err) {
            return 'Error editing data: ' + err.message;
        }
    }
    async editUserDataById(id, data) {
        try {
            await mainDb.transaction(async trx => {
                const updatedRows = await trx('users')
                    .where('id', id)
                    .update(data);
    
                if (updatedRows === 0) {
                    return 'No data found with the given username';
                }
            });
            return true;
        } catch (err) {
            return 'Error editing data: ' + err.message;
        }
    }
    _userList(filters, columnSearches) {
        let query = mainDb('users').select('*').where({isactive: 1}).andWhere('username', '!=', 'admin')
        if (filters.search_value) {
            query.where(function() {
                this.orWhere('fullname', 'like', `%${filters.search_value}%`)
            });
        }
        columnSearches.forEach(search => {
            query.where(search.column, 'like', `%${search.value}%`)
        });

        return query
    }
    async userList(filters, orderColumn, orderDirection, columnSearches) {
        let query = this._userList(filters, columnSearches)
        
        query.orderBy(orderColumn, orderDirection)
        query.limit(filters.length).offset(filters.start)

        const results = await query
        return results
    }

    async userListFiltered(filters, columnSearches) {
        let query = this._userList(filters, columnSearches)

        const count = await query.count('* as total').first();
        return count.total;
    }
    async userListCountAll() {
        let query = mainDb('users');
        const result = await query.count('* as total').first();
        return result ? result.total : 0;
    }
}

module.exports = new mainModel();
