const aksesDb = require('../models/aksesDb');

const moment = require('moment');

class aksesModel {
    //===================================================================================================================================
    //===================================================================================================================================
    //MANAGE ACCESS USERS
    //===================================================================================================================================
    //===================================================================================================================================
    async addUserData(data) {
        try {
            await aksesDb.transaction(async trx => {
                await trx('user_akses').insert(data);
            });
            return true;
        } catch (err) {
            return 'Error adding data:' + err;
        }
    }
    async getUserDataById(id) {
        try {
            const data = await aksesDb('user_akses').select('*').where({ 'id': id, 'is_active': 1 }).first();
            return data;
        } catch (err) {
            console.error('Error fetching data', err);
            throw new Error('Failed to fetch ');
        }
    }
    async getUsedFP() {
        try {
            return await aksesDb('user_akses')
            .where({ tipe: 2, is_active: 1 })
            .pluck('id_tipe'); // langsung return array id_tipe
        } catch (err) {
            console.error('❌ Error fetching used fingerprint IDs:', err);
            throw new Error('Failed to fetch used fingerprint IDs');
        }
    }

    async findUser(tipe, id) {
        try {
            const data = await aksesDb('user_akses').select('*').where({ 'tipe': tipe, 'id_tipe':id, 'is_active': 1 }).first();
            return data;
        } catch (err) {
            console.error('Error fetching data', err);
            throw new Error('Failed to fetch ');
        }
    }
    async editUserDataById(id, data) {
        try {
            await aksesDb.transaction(async trx => {
                const updatedRows = await trx('user_akses')
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
        let query = aksesDb('user_akses').select('*').where({is_active: 1})
        if (filters.search_value) {
            query.where(function() {
                this.orWhere('nama', 'like', `%${filters.search_value}%`)
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
        let query = aksesDb('user_akses');
        const result = await query.count('* as total').first();
        return result ? result.total : 0;
    }

    //====================================================================================================================
    //====================================================================================================================
    //====================================================================================================================
    //uAccess===============================================================================================================
    _uAccess(filters, columnSearches) {
        let query = aksesDb('user_akses')
            .select('*')
    
        if (filters.tipe > 0) {
            query.where(function() {
                this.where('tipe', filters.tipe);
            });
        }
        if (columnSearches.length > 0) {
            query.where(function () {
                columnSearches.forEach((col) => {
                    this.orWhere(col.column, 'like', `%${col.value}%`);
                });
            });
        }
    
        return query;
    }
    async uAccess(filters, orderColumn, orderDirection, columnSearches) {
        let query = this._uAccess(filters, columnSearches)
        
        query.orderBy(orderColumn, orderDirection)
        query.limit(filters.length).offset(filters.start)

        const results = await query
        return results
    }

    async uAccessFiltered(filters, columnSearches) {
        let query = this._uAccess(filters, columnSearches)

        const count = await query.count('* as total').first();
        return count.total;
    }
    async uAccessCountAll() {
        let query = aksesDb('user_akses');
        const result = await query.count('* as total').first();
        return result ? result.total : 0;
    }
    //====================================================================================================================
    //===================================================================================================================================
    //===================================================================================================================================
    //LOG ACCESS
    //===================================================================================================================================
    //===================================================================================================================================
    async logAccess(data) {
        try {
            await aksesDb.transaction(async trx => {
                await trx('log_akses').insert(data);
            });
            return true;
        } catch (err) {
            return 'Error adding data:' + err;
        }
    }
    async updateLogAccess() {
        try {
            const affectedRows = await aksesDb.transaction(async trx => {
                return trx('log_akses')
                    .where({
                        is_success: 1,
                    })
                    .whereNull('out_time')
                    .update({
                        out_time: new Date() 
                    });
            });
            if (affectedRows > 0) {
                return true;
            } else {
                return false;
            }
        } catch (err) {
            return 'Error updating data: ' + err.message;
        }
    }
    //====================================================================================================================
    //====================================================================================================================
    //====================================================================================================================
    //LogAccess===============================================================================================================
    _inAccess(filters, columnSearches) {
        let today = moment().format('YYYY-MM-01');
        let startDate = filters.startDate ? moment(filters.startDate).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
        let endDate = filters.endDate ? moment(filters.endDate).format('YYYY-MM-DD') : moment().add(1, 'day').format('YYYY-MM-DD');

        let query = aksesDb('log_akses')
            .select('log_akses.*', 'user_akses.nama') // Select all columns from pwmeter_alarm and the showname column from devlist
            .leftJoin('user_akses', 'log_akses.user_id', '=', 'user_akses.id'); // Join with devlist table
    
        if (startDate) {
            query.where(function() {
                this.where('log_akses.in_time', '>=', startDate);
            });
        }
        if (endDate) {
            query.where(function() {
                this.where('log_akses.in_time', '<=', endDate);
            });
        }
        if (columnSearches.length > 0) {
            query.where(function () {
                columnSearches.forEach((col) => {
                    this.orWhere(col.column, 'like', `%${col.value}%`);
                });
            });
        }
    
        return query;
    }
    async inAccess(filters, orderColumn, orderDirection, columnSearches) {
        let query = this._inAccess(filters, columnSearches)
        
        query.orderBy(orderColumn, orderDirection)
        query.limit(filters.length).offset(filters.start)

        const results = await query
        return results
    }

    async inAccessFiltered(filters, columnSearches) {
        let query = this._inAccess(filters, columnSearches)

        const count = await query.count('* as total').first();
        return count.total;
    }
    async inAccessCountAll() {
        let query = aksesDb('log_akses');
        const result = await query.count('* as total').first();
        return result ? result.total : 0;
    }

    //====================================================================================================================
    //====================================================================================================================
    //====================================================================================================================
    async getActiveStreams() {
        return await aksesDb('url_stream')
            .select('url');
        }

}

module.exports = new aksesModel();
