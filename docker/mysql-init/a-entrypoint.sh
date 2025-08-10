#!/bin/bash

# Fix MySQL config file permissions
if [ -f "/etc/my.cnf" ]; then
    chmod 644 /etc/my.cnf
elif [ -f "/etc/mysql/my.cnf" ]; then
    chmod 644 /etc/mysql/my.cnf
else
    echo "my.cnf not found; skipping chmod."
fi

# Ensure MySQL data directory is initialized
if [ ! -d "/var/lib/mysql/mysql" ]; then
    echo "Initializing MySQL database..."
    mysqld --initialize-insecure
fi

# Run MySQL with init SQL
exec docker-entrypoint.sh mysqld --init-file=/docker-entrypoint-initdb.d/b-init.sql