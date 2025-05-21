// src/controllers/users.js

import connectDB from '../db/index.js';

// Create a new user
export const createUser = async (req, res) => {
    console.log('Received user creation request:', req.body);

    const {
        username,
        email,
        mobile_num,
        mobile_num_2,
        team_id,
        designation
    } = req.body;

    // Validate required fields
    if (!username || !email || !mobile_num || !team_id || !designation) {
        console.log('Missing fields:', { username, email, mobile_num, team_id, designation });
        return res.status(400).json({ 
            error: 'Missing required fields: username, email, mobile_num, and team_id are required',
            received: { username, email, mobile_num, team_id }
        });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    try {
        const pool = connectDB();
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            // Check if user already exists in the same team
            const [existingUser] = await conn.query(
                'SELECT * FROM team_members WHERE (email = ? OR username = ? OR mobile_num = ?) AND team_id = ?',
                [email, username, mobile_num, team_id]
            );

            if (existingUser.length > 0) {
                await conn.rollback();
                let errorField = '';
                if (existingUser[0].email === email) errorField = 'email';
                else if (existingUser[0].username === username) errorField = 'username';
                else errorField = 'mobile number';
                
                return res.status(400).json({ 
                    error: `A user with this ${errorField} already exists in the selected team`,
                    field: errorField.replace(' ', '_')
                });
            }

            // Create user
            const [userResult] = await conn.query(
                'INSERT INTO team_members (username, email, mobile_num, mobile_num_2, team_id, designation) VALUES (?, ?, ?, ?, ?, ?)',
                [username, email, mobile_num, mobile_num_2, team_id, designation]
            );

            await conn.commit();

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                user_id: userResult.insertId
            });

        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get all users with their teams
export const getAllUsers = async (req, res) => {
    const pool = connectDB();
    let connection;
    try {
        connection = await pool.getConnection();

        // Get all team members with their team info
        const [users] = await connection.query(`
            SELECT tm.*, t.team_name
            FROM team_members tm
            LEFT JOIN teams t ON tm.team_id = t.id
            ORDER BY tm.created_at DESC
        `);

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Get team members for a specific team
export const getTeamMembers = async (req, res) => {
    const pool = connectDB();
    let connection;
    try {
        connection = await pool.getConnection();

        // Get team members
        const [users] = await connection.query(`
            SELECT tm.*, t.team_name
            FROM team_members tm
            LEFT JOIN teams t ON tm.team_id = t.id
            WHERE tm.team_id = ?
            ORDER BY tm.created_at DESC
        `, [req.params.teamId]);

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};
