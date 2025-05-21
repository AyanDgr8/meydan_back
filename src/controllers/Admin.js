// src/controllers/Admin.js

import bcrypt from 'bcrypt';
import connectDB from '../db/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const createAdmin = async () => {
    // Admin credentials
    const username = 'Ayan Khan';
    const email = 'ayan@multycomm.com';
    const plainPassword = 'Ayan1012';
    
    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        
        // Get database connection pool
        const pool = connectDB();
        
        // Get a connection from the pool
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // Check if admin already exists
            const [existingAdmin] = await connection.query(
                'SELECT id FROM admin WHERE email = ? OR username = ?',
                [email, username]
            );

            if (existingAdmin.length > 0) {
                console.log('Admin already exists. Updating password...');
                await connection.query(
                    'UPDATE admin SET password = ? WHERE email = ?',
                    [hashedPassword, email]
                );
            } else {
                // Create new admin
                await connection.query(
                    'INSERT INTO admin (username, email, password) VALUES (?, ?, ?)',
                    [username, email, hashedPassword]
                );
            }

            await connection.commit();
            console.log('Admin created successfully!');
            console.log('Username:', username);
            console.log('Email:', email);
            console.log('Password:', plainPassword);
            console.log('Please save these credentials securely.');

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error creating Admin:', error);
    }
};

// Run the function
createAdmin();